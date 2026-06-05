from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_paste_content


class PasteProcessor(BaseSourceProcessor):
    source_type = "paste"

    def validate(self, title: str = "", content: str = "", **kwargs) -> None:
        validate_paste_content(title, content)

    def extract(self, title: str = "", content: str = "", **kwargs) -> ExtractionResult:
        validate_paste_content(title, content)
        metadata = {"char_count": len(content), "source": "pasted_text"}
        return ExtractionResult(text=content, metadata=metadata, title=title)
