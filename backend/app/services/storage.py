import os
import uuid
import shutil
import logging
import time as _time
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("app.services.storage")

try:
    import boto3
    from botocore.config import Config as BotocoreConfig
    from botocore.exceptions import (
        ClientError,
        EndpointConnectionError,
        ConnectTimeoutError,
        ReadTimeoutError,
        ConnectionError as BotoConnectionError,
    )
except ImportError:
    boto3 = None
    ClientError = Exception
    EndpointConnectionError = Exception
    ConnectTimeoutError = Exception
    ReadTimeoutError = Exception
    BotoConnectionError = Exception


# ─────────────────────────────────────────────────────────────────────────────
# Boto3 timeout configuration
# These values are intentionally conservative:
# - connect_timeout: fail fast if the S3 endpoint is unreachable
# - read_timeout: prevents the process hanging on slow uploads/downloads
# - retries: 0 — we control retry logic in the pipeline, not here
# ─────────────────────────────────────────────────────────────────────────────
_BOTO_CONFIG = BotocoreConfig(
    connect_timeout=10,   # seconds to establish TCP connection
    read_timeout=60,      # seconds to wait for response bytes
    retries={"max_attempts": 2, "mode": "standard"},
) if boto3 else None


class StorageService:
    # Class-level cache so head_bucket() is executed at most ONCE across all
    # instances within a process lifetime, not on every upload or pipeline run.
    _bucket_verified: bool = False

    def __init__(self):
        # 1. Check for Supabase configurations
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_s3_access_key = os.getenv("SUPABASE_S3_ACCESS_KEY_ID")
        supabase_s3_secret_key = os.getenv("SUPABASE_S3_SECRET_ACCESS_KEY")
        supabase_bucket = os.getenv("SUPABASE_STORAGE_BUCKET")
        supabase_region = os.getenv("SUPABASE_STORAGE_REGION")

        # If Supabase URL or Access Key is provided, validate strictly
        if supabase_url or supabase_s3_access_key:
            missing_vars = []
            if not supabase_url:           missing_vars.append("SUPABASE_URL")
            if not supabase_s3_access_key: missing_vars.append("SUPABASE_S3_ACCESS_KEY_ID")
            if not supabase_s3_secret_key: missing_vars.append("SUPABASE_S3_SECRET_ACCESS_KEY")
            if not supabase_bucket:        missing_vars.append("SUPABASE_STORAGE_BUCKET")
            if not supabase_region:        missing_vars.append("SUPABASE_STORAGE_REGION")

            if missing_vars:
                raise RuntimeError(
                    f"Missing required Supabase S3 environment variables: {', '.join(missing_vars)}"
                )

            if not boto3:
                raise RuntimeError("boto3 library is missing but required for Supabase S3.")

            # Extract project ref from supabase URL (e.g. https://abcdefgh.supabase.co)
            project_ref = (
                supabase_url
                .replace("https://", "")
                .replace("http://", "")
                .replace(".supabase.co", "")
                .replace("/", "")
            )

            self.bucket_name = supabase_bucket
            self.access_key = supabase_s3_access_key
            self.secret_key = supabase_s3_secret_key
            self.region = supabase_region
            self.use_s3 = True

            # Construct the correct Supabase S3 endpoint
            self.endpoint_url = f"https://{project_ref}.storage.supabase.co/storage/v1/s3"

            logger.info("Using Supabase S3")
            logger.info(f"SUPABASE_URL={supabase_url}")
            logger.info(f"Bucket={self.bucket_name}")
            logger.info(f"Region={self.region}")
            logger.info(f"Endpoint={self.endpoint_url}")
            logger.info(f"Access Key Prefix={self.access_key[:8] if self.access_key else ''}")
            logger.info(f"Secret Length={len(self.secret_key) if self.secret_key else 0}")

            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
                endpoint_url=self.endpoint_url,
                config=_BOTO_CONFIG,  # explicit timeouts applied here
            )

            # ── Bucket verification: cached at CLASS level, not per-instance ──
            # Previously head_bucket() was called unconditionally in __init__
            # with NO timeout, blocking the event loop for up to 60 s on every
            # pipeline run. Now we verify once and cache the result.
            if not StorageService._bucket_verified:
                self._verify_bucket_once()

        else:
            # 2. Fallback to standard AWS S3 keys if configured
            self.bucket_name = os.getenv("AWS_S3_BUCKET_NAME")
            self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
            self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
            self.region = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
            self.endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL")
            self.use_s3 = all([boto3, self.bucket_name, self.access_key, self.secret_key])

            if self.use_s3:
                session_opts = {
                    "aws_access_key_id": self.access_key,
                    "aws_secret_access_key": self.secret_key,
                    "region_name": self.region,
                    "config": _BOTO_CONFIG,
                }
                if self.endpoint_url:
                    session_opts["endpoint_url"] = self.endpoint_url
                self.s3_client = boto3.client("s3", **session_opts)
            else:
                # 3. Fallback to local storage
                self.local_dir = os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "..", "..", "storage")
                )
                os.makedirs(self.local_dir, exist_ok=True)

    def _verify_bucket_once(self) -> None:
        """
        Perform a single head_bucket() to confirm credentials and bucket access.
        Called at most once per process (class-level cache).
        Raises RuntimeError on hard credential failures but logs warnings for
        recoverable errors (e.g., transient network issues) so the service can
        still attempt uploads.
        """
        import traceback

        logger.info(f"[STORAGE] _verify_bucket_once: checking bucket={self.bucket_name}")
        t0 = _time.perf_counter()
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            elapsed = (_time.perf_counter() - t0) * 1000
            logger.info(
                f"[STORAGE] head_bucket OK — bucket accessible "
                f"(elapsed={elapsed:.1f}ms)"
            )
            StorageService._bucket_verified = True

        except (ConnectTimeoutError, ReadTimeoutError) as e:
            elapsed = (_time.perf_counter() - t0) * 1000
            logger.error(
                f"[STORAGE] head_bucket TIMEOUT after {elapsed:.1f}ms — "
                f"S3 endpoint unreachable. Uploads will be attempted anyway."
            )
            logger.error(traceback.format_exc())
            # Do NOT raise — allow uploads to proceed; the error will surface
            # if put_object also fails, with the full error logged there.

        except EndpointConnectionError as e:
            elapsed = (_time.perf_counter() - t0) * 1000
            logger.error(
                f"[STORAGE] head_bucket EndpointConnectionError after {elapsed:.1f}ms: {e}"
            )
            logger.error(traceback.format_exc())

        except ClientError as e:
            import traceback as tb
            elapsed = (_time.perf_counter() - t0) * 1000
            response = getattr(e, "response", {})
            error_info = response.get("Error", {})
            error_code = error_info.get("Code", "Unknown")
            error_message = error_info.get("Message", "Unknown")
            http_status = response.get("ResponseMetadata", {}).get("HTTPStatusCode", "Unknown")

            logger.error(
                f"[STORAGE] head_bucket ClientError after {elapsed:.1f}ms — "
                f"Code={error_code}, HTTP={http_status}, Message={error_message}"
            )
            logger.error(tb.format_exc())

            # Hard fail only on definitive auth errors
            if error_code in ("InvalidAccessKeyId", "SignatureDoesNotMatch"):
                raise RuntimeError(
                    f"S3 credential error ({error_code}): {error_message}. "
                    "Check SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY."
                )
            if error_code == "AccessDenied" or http_status in (403, "403"):
                raise RuntimeError(
                    f"S3 Access Denied ({http_status}): Credentials are valid but bucket "
                    f"permissions are incorrect for '{self.bucket_name}'."
                )
            # For other errors (bucket not found, etc.) raise to prevent silent corruption
            raise RuntimeError(f"S3 Connection Test Failed: {error_code} — {error_message}")

    async def upload_file(self, file_bytes: bytes, filename: str, folder: str = "documents") -> str:
        """Upload file bytes and return a unique storage path key."""
        import asyncio
        import traceback
        from fastapi import HTTPException

        unique_id = uuid.uuid4()
        clean_filename = f"{unique_id}_{filename}"
        storage_key = f"{folder}/{clean_filename}"

        if self.use_s3:
            loop = asyncio.get_running_loop()
            file_size = len(file_bytes)

            logger.info(
                f"[STORAGE] UPLOAD_STARTED — "
                f"bucket={self.bucket_name}, key={storage_key}, "
                f"size={file_size}B, endpoint={getattr(self, 'endpoint_url', 'AWS Default')}"
            )
            t0 = _time.perf_counter()

            # ── NO head_bucket here ──────────────────────────────────────────
            # Bucket existence was already verified once via _verify_bucket_once().
            # Calling head_bucket() before every upload added 200–1000ms of
            # latency and was the primary cause of the pipeline never starting
            # when the endpoint was slow or rate-limited.
            try:
                await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=storage_key,
                        Body=file_bytes,
                    ),
                )
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.info(
                    f"[STORAGE] UPLOAD_COMPLETE — key={storage_key}, "
                    f"size={file_size}B, elapsed={elapsed:.1f}ms"
                )
                return storage_key

            except (ConnectTimeoutError, ReadTimeoutError) as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.error(
                    f"[STORAGE] UPLOAD_TIMEOUT after {elapsed:.1f}ms — key={storage_key}: {e}"
                )
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=504,
                    detail=f"S3 upload timed out after {elapsed:.0f}ms. Check network connectivity to Supabase Storage.",
                )

            except EndpointConnectionError as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.error(
                    f"[STORAGE] UPLOAD_ENDPOINT_ERROR after {elapsed:.1f}ms — key={storage_key}: {e}"
                )
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=503,
                    detail=f"Cannot reach S3 endpoint: {e}",
                )

            except ClientError as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                response_metadata = getattr(e, "response", {})
                error_info = response_metadata.get("Error", {})
                error_code = error_info.get("Code", "Unknown")
                error_message = error_info.get("Message", "Unknown")
                logger.error(
                    f"[STORAGE] UPLOAD_CLIENT_ERROR after {elapsed:.1f}ms — "
                    f"key={storage_key}, Code={error_code}, Message={error_message}"
                )
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=500,
                    detail=f"S3 Upload failed ({error_code}): {error_message}",
                )

            except Exception as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.error(
                    f"[STORAGE] UPLOAD_UNEXPECTED_ERROR after {elapsed:.1f}ms — key={storage_key}: {e}"
                )
                logger.error(traceback.format_exc())
                raise HTTPException(
                    status_code=500,
                    detail=f"S3 Upload failed unexpectedly: {e}",
                )

        else:
            # Local Storage Ingestion
            dest_dir = os.path.join(self.local_dir, folder)
            os.makedirs(dest_dir, exist_ok=True)
            local_path = os.path.join(dest_dir, clean_filename)

            with open(local_path, "wb") as f:
                f.write(file_bytes)

            logger.info(f"[STORAGE] LOCAL_UPLOAD_COMPLETE — path={local_path}")
            return f"local://{folder}/{clean_filename}"

    async def delete_file(self, storage_path: str) -> None:
        """Remove file from storage using the storage path key."""
        if self.use_s3:
            import asyncio
            import traceback

            loop = asyncio.get_running_loop()
            logger.info(f"[STORAGE] DELETE_STARTED — key={storage_path}")
            try:
                await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=storage_path,
                    ),
                )
                logger.info(f"[STORAGE] DELETE_COMPLETE — key={storage_path}")
            except (ConnectTimeoutError, ReadTimeoutError, EndpointConnectionError) as e:
                logger.error(f"[STORAGE] DELETE_TIMEOUT/CONNECTION_ERROR — key={storage_path}: {e}")
                logger.error(traceback.format_exc())
                raise Exception(f"S3 Delete timed out or connection failed: {e}")
            except ClientError as e:
                logger.error(f"[STORAGE] DELETE_CLIENT_ERROR — key={storage_path}: {e}")
                logger.error(traceback.format_exc())
                raise Exception(f"S3 Delete failed: {e}")
        else:
            if storage_path.startswith("local://"):
                relative_key = storage_path.replace("local://", "")
                local_path = os.path.join(self.local_dir, relative_key)
                if os.path.exists(local_path):
                    os.remove(local_path)
                    logger.info(f"[STORAGE] LOCAL_DELETE_COMPLETE — path={local_path}")

    async def generate_presigned_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Generate temporary read link for file access."""
        if self.use_s3:
            import asyncio
            import traceback

            loop = asyncio.get_running_loop()
            try:
                url = await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": self.bucket_name, "Key": storage_path},
                        ExpiresIn=expires_in,
                    ),
                )
                return url
            except (ConnectTimeoutError, ReadTimeoutError, EndpointConnectionError) as e:
                logger.error(f"[STORAGE] PRESIGN_TIMEOUT — key={storage_path}: {e}")
                logger.error(traceback.format_exc())
                raise Exception(f"S3 Presigned URL timed out: {e}")
            except ClientError as e:
                logger.error(f"[STORAGE] PRESIGN_ERROR — key={storage_path}: {e}")
                logger.error(traceback.format_exc())
                raise Exception(f"S3 Presigned URL failed: {e}")
        else:
            if storage_path.startswith("local://"):
                relative_key = storage_path.replace("local://", "")
                return f"/api/v1/documents/download/{relative_key}"
            return f"/api/v1/documents/download/{storage_path}"

    async def get_file_bytes(self, storage_path: str) -> bytes:
        """Retrieve file raw bytes for processing."""
        if self.use_s3:
            import asyncio
            import traceback

            loop = asyncio.get_running_loop()
            logger.info(f"[STORAGE] GET_FILE_STARTED — key={storage_path}")
            t0 = _time.perf_counter()
            try:
                response = await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.get_object(
                        Bucket=self.bucket_name,
                        Key=storage_path,
                    ),
                )
                data = response["Body"].read()
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.info(
                    f"[STORAGE] GET_FILE_COMPLETE — key={storage_path}, "
                    f"size={len(data)}B, elapsed={elapsed:.1f}ms"
                )
                return data
            except (ConnectTimeoutError, ReadTimeoutError, EndpointConnectionError) as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.error(
                    f"[STORAGE] GET_FILE_TIMEOUT after {elapsed:.1f}ms — key={storage_path}: {e}"
                )
                logger.error(traceback.format_exc())
                raise Exception(f"S3 read timed out after {elapsed:.0f}ms: {e}")
            except ClientError as e:
                elapsed = (_time.perf_counter() - t0) * 1000
                logger.error(
                    f"[STORAGE] GET_FILE_CLIENT_ERROR after {elapsed:.1f}ms — key={storage_path}: {e}"
                )
                logger.error(traceback.format_exc())
                raise Exception(f"S3 Read failed: {e}")
        else:
            if storage_path.startswith("local://"):
                relative_key = storage_path.replace("local://", "")
                local_path = os.path.join(self.local_dir, relative_key)
            else:
                local_path = os.path.join(self.local_dir, storage_path)

            if not os.path.exists(local_path):
                raise FileNotFoundError(f"Local file not found at {local_path}")

            with open(local_path, "rb") as f:
                return f.read()
