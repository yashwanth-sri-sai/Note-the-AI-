import os
import uuid
import shutil
from typing import Optional
from app.core.config import settings

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception


class StorageService:
    def __init__(self):
        import logging
        logger = logging.getLogger("app.services.storage")
        
        # 1. Check for Supabase configurations
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_s3_access_key = os.getenv("SUPABASE_S3_ACCESS_KEY_ID")
        supabase_s3_secret_key = os.getenv("SUPABASE_S3_SECRET_ACCESS_KEY")
        supabase_bucket = os.getenv("SUPABASE_STORAGE_BUCKET")
        supabase_region = os.getenv("SUPABASE_STORAGE_REGION")
        
        # If Supabase URL or Access Key is provided, validate strictly for Supabase S3 integration
        if supabase_url or supabase_s3_access_key:
            missing_vars = []
            if not supabase_url: missing_vars.append("SUPABASE_URL")
            if not supabase_s3_access_key: missing_vars.append("SUPABASE_S3_ACCESS_KEY_ID")
            if not supabase_s3_secret_key: missing_vars.append("SUPABASE_S3_SECRET_ACCESS_KEY")
            if not supabase_bucket: missing_vars.append("SUPABASE_STORAGE_BUCKET")
            if not supabase_region: missing_vars.append("SUPABASE_STORAGE_REGION")
            
            if missing_vars:
                raise RuntimeError(f"Missing required Supabase S3 environment variables: {', '.join(missing_vars)}")
                
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
            
            session_opts = {
                "aws_access_key_id": self.access_key,
                "aws_secret_access_key": self.secret_key,
                "region_name": self.region,
                "endpoint_url": self.endpoint_url,
            }
            self.s3_client = boto3.client("s3", **session_opts)
            
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
                logger.info("Successfully authenticated with Supabase S3 via head_bucket()")
            except ClientError as e:
                import traceback
                logger.error("Boto3 Authentication Test Failed (head_bucket)")
                logger.error(traceback.format_exc())
                
                response = getattr(e, "response", {})
                error_info = response.get("Error", {})
                
                error_code = error_info.get("Code", "Unknown")
                error_message = error_info.get("Message", "Unknown")
                http_status = response.get("ResponseMetadata", {}).get("HTTPStatusCode", "Unknown")
                
                logger.error(f"AWS Error Code: {error_code}")
                logger.error(f"AWS Error Message: {error_message}")
                logger.error(f"HTTP Status: {http_status}")
                logger.error(f"Complete ClientError.response: {response}")
                
                if error_code == "InvalidAccessKeyId":
                    logger.error("The Access Key ID is being rejected by Supabase.")
                elif error_code == "SignatureDoesNotMatch":
                    logger.error("The Secret Access Key is incorrect.")
                elif error_code == "AccessDenied" or http_status == 403 or http_status == "403":
                    logger.error("Credentials are valid but bucket permissions are incorrect.")
                    
                raise RuntimeError(f"S3 Connection Test Failed: {e}")
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
                }
                if self.endpoint_url:
                    session_opts["endpoint_url"] = self.endpoint_url
                self.s3_client = boto3.client("s3", **session_opts)
            else:
                # 3. Fallback to local storage
                self.local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
                os.makedirs(self.local_dir, exist_ok=True)

    async def upload_file(self, file_bytes: bytes, filename: str, folder: str = "documents") -> str:
        """Upload file bytes and return a unique storage path key."""
        unique_id = uuid.uuid4()
        clean_filename = f"{unique_id}_{filename}"
        storage_key = f"{folder}/{clean_filename}"

        if self.use_s3:
            import logging
            import asyncio
            from fastapi import HTTPException
            import traceback
            
            logger = logging.getLogger("app.services.storage")
            logger.info(f"Initiating S3 upload. Bucket: {self.bucket_name}, Key: {storage_key}, Endpoint: {getattr(self, 'endpoint_url', 'AWS Default')}")
            
            loop = asyncio.get_running_loop()
            
            # Verify bucket exists before upload
            try:
                await loop.run_in_executor(None, lambda: self.s3_client.head_bucket(Bucket=self.bucket_name))
            except ClientError as e:
                logger.error(f"head_bucket failed for {self.bucket_name}: {e}")
                raise RuntimeError(f"Storage bucket '{self.bucket_name}' does not exist or is inaccessible: {e}")
            
            try:
                await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=storage_key,
                        Body=file_bytes
                    )
                )
                return storage_key
            except ClientError as e:
                logger.error("S3 Upload Failed")
                logger.error(traceback.format_exc())
                response_metadata = getattr(e, "response", {})
                error_info = response_metadata.get("Error", {})
                logger.error(f"ClientError.response: {response_metadata}")
                logger.error(f"Error Code: {error_info.get('Code', 'Unknown')}")
                logger.error(f"Error Message: {error_info.get('Message', 'Unknown')}")
                
                raise HTTPException(
                    status_code=500,
                    detail=f"S3 Upload failed: {error_info.get('Message', str(e))}"
                )
        else:
            # Local Storage Ingestion
            dest_dir = os.path.join(self.local_dir, folder)
            os.makedirs(dest_dir, exist_ok=True)
            local_path = os.path.join(dest_dir, clean_filename)
            
            with open(local_path, "wb") as f:
                f.write(file_bytes)
            
            # Return relative path as storage key
            return f"local://{folder}/{clean_filename}"

    async def delete_file(self, storage_path: str) -> None:
        """Remove file from storage using the storage path key."""
        if self.use_s3:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=storage_path
                    )
                )
            except ClientError as e:
                raise Exception(f"S3 Delete failed: {e}")
        else:
            if storage_path.startswith("local://"):
                relative_key = storage_path.replace("local://", "")
                local_path = os.path.join(self.local_dir, relative_key)
                if os.path.exists(local_path):
                    os.remove(local_path)

    async def generate_presigned_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Generate temporary read link for file access."""
        if self.use_s3:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                return await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": self.bucket_name, "Key": storage_path},
                        ExpiresIn=expires_in
                    )
                )
            except ClientError as e:
                raise Exception(f"S3 Presigned URL failed: {e}")
        else:
            # Fallback mock HTTP download endpoint or file URI
            if storage_path.startswith("local://"):
                relative_key = storage_path.replace("local://", "")
                return f"/api/v1/documents/download/{relative_key}"
            return f"/api/v1/documents/download/{storage_path}"
            
    async def get_file_bytes(self, storage_path: str) -> bytes:
        """Retrieve file raw bytes for processing."""
        if self.use_s3:
            try:
                import asyncio
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.s3_client.get_object(
                        Bucket=self.bucket_name,
                        Key=storage_path
                    )
                )
                return response["Body"].read()
            except ClientError as e:
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
