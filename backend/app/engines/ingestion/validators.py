import os
from typing import Optional

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_FILES_PER_UPLOAD = 20
MAX_BATCH_SIZE = 500 * 1024 * 1024  # 500 MB

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".md"}
ALLOWED_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
}


class ValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def get_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


def validate_file(filename: str, content: bytes) -> str:
    ext = get_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Unsupported file format '{ext}'. Allowed: PDF, DOCX, PPTX, TXT, MD."
        )
    if len(content) > MAX_FILE_SIZE:
        raise ValidationError(
            f"File '{filename}' exceeds the 50 MB limit ({len(content) / (1024 * 1024):.1f} MB)."
        )
    if len(content) == 0:
        raise ValidationError(f"File '{filename}' is empty.")
    return ext


def validate_upload_batch(files: list[tuple[str, bytes]]) -> None:
    if not files:
        raise ValidationError("No files provided.")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise ValidationError(
            f"Too many files. Maximum {MAX_FILES_PER_UPLOAD} files per upload."
        )
    total_size = sum(len(content) for _, content in files)
    if total_size > MAX_BATCH_SIZE:
        raise ValidationError(
            f"Total upload size exceeds 500 MB limit ({total_size / (1024 * 1024):.1f} MB)."
        )


def validate_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise ValidationError("URL must start with http:// or https://")
    return url


def validate_youtube_url(url: str) -> str:
    url = url.strip()
    valid_patterns = ["youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com"]
    if not any(p in url for p in valid_patterns):
        raise ValidationError("Please provide a valid YouTube URL.")
    return url


def validate_paste_content(title: str, content: str) -> None:
    if not title.strip():
        raise ValidationError("Source title is required.")
    if not content.strip():
        raise ValidationError("Content cannot be empty.")
    if len(content) > 5_000_000:
        raise ValidationError("Content exceeds maximum length of 5 million characters.")
