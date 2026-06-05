from .pdf import PDFProcessor
from .docx import DOCXProcessor
from .pptx import PPTXProcessor
from .text import TextProcessor
from .markdown import MarkdownProcessor
from .website import WebsiteProcessor
from .youtube import YouTubeProcessor
from .paste import PasteProcessor

PROCESSOR_MAP = {
    "pdf": PDFProcessor,
    "docx": DOCXProcessor,
    "pptx": PPTXProcessor,
    "txt": TextProcessor,
    "md": MarkdownProcessor,
    "website": WebsiteProcessor,
    "youtube": YouTubeProcessor,
    "paste": PasteProcessor,
}

__all__ = [
    "PDFProcessor",
    "DOCXProcessor",
    "PPTXProcessor",
    "TextProcessor",
    "MarkdownProcessor",
    "WebsiteProcessor",
    "YouTubeProcessor",
    "PasteProcessor",
    "PROCESSOR_MAP",
]
