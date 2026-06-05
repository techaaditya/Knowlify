import re
from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_file


class MarkdownProcessor(BaseSourceProcessor):
    source_type = "md"

    def validate(self, filename: str = "", content: bytes = b"", **kwargs) -> None:
        validate_file(filename, content)

    def extract(self, filename: str = "", content: bytes = b"", **kwargs) -> ExtractionResult:
        text = content.decode("utf-8", errors="replace")
        headers = re.findall(r"^#{1,6}\s+(.+)$", text, re.MULTILINE)
        code_blocks = len(re.findall(r"```", text)) // 2
        title = filename or (headers[0] if headers else "Markdown Document")
        metadata = {"header_count": len(headers), "code_block_count": code_blocks}
        return ExtractionResult(text=text, metadata=metadata, title=title)
