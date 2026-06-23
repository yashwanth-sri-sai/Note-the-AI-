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
        # 1. Check for Supabase configurations
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if boto3 and supabase_url and supabase_key:
            # Extract project ref from supabase URL (e.g. https://xvpluvbtqzwzqkwckwsc.supabase.co -> xvpluvbtqzwzqkwckwsc)
            project_ref = supabase_url.replace("https://", "").replace("http://", "").split(".")[0]
            self.bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "documents")
            self.access_key = project_ref
            self.secret_key = supabase_key
            self.endpoint_url = f"{supabase_url.rstrip('/')}/storage/v1/s3"
            self.region = os.getenv("SUPABASE_STORAGE_REGION", "ap-northeast-1")
            self.use_s3 = True
            
            session_opts = {
                "aws_access_key_id": self.access_key,
                "aws_secret_access_key": self.secret_key,
                "region_name": self.region,
                "endpoint_url": self.endpoint_url,
            }
            self.s3_client = boto3.client("s3", **session_opts)
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
            try:
                # Run synchronous s3 upload in an executor
                import asyncio
                loop = asyncio.get_running_loop()
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
                raise Exception(f"S3 Upload failed: {e}")
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
