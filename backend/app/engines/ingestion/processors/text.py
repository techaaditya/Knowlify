from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_file


class TextProcessor(BaseSourceProcessor):
    source_type = "txt"

    def validate(self, filename: str = "", content: bytes = b"", **kwargs) -> None:
        validate_file(filename, content)

    def extract(self, filename: str = "", content: bytes = b"", **kwargs) -> ExtractionResult:
        text = content.decode("utf-8", errors="replace")
        title = filename or "Text Document"
        return ExtractionResult(text=text, metadata={"char_count": len(text)}, title=title)
