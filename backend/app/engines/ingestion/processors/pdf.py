import fitz
from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_file


class PDFProcessor(BaseSourceProcessor):
    source_type = "pdf"

    def validate(self, filename: str = "", content: bytes = b"", **kwargs) -> None:
        validate_file(filename, content)

    def extract(self, filename: str = "", content: bytes = b"", filepath: str = "", **kwargs) -> ExtractionResult:
        if filepath:
            doc = fitz.open(filepath)
        else:
            doc = fitz.open(stream=content, filetype="pdf")

        pages_text = []
        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages_text.append(f"--- Page {page_num + 1} ---\n{text}")

        full_text = "\n\n".join(pages_text)
        metadata = {
            "page_count": doc.page_count,
            "filename": filename or filepath,
        }
        title = filename or (filepath.split("/")[-1] if filepath else "PDF Document")
        doc.close()
        return ExtractionResult(text=full_text, metadata=metadata, title=title)
