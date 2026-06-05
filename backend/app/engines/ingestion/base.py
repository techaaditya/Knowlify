import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ExtractionResult:
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)
    title: Optional[str] = None


class BaseSourceProcessor(ABC):
    source_type: str = "unknown"

    @abstractmethod
    def validate(self, **kwargs) -> None:
        pass

    @abstractmethod
    def extract(self, **kwargs) -> ExtractionResult:
        pass

    def clean(self, text: str) -> str:
        from .cleaner import normalize_content
        return normalize_content(text)

    def _resolve_file_content(self, kwargs: dict) -> dict:
        """Load file bytes from disk when background jobs only pass filepath."""
        resolved = dict(kwargs)
        content = resolved.get("content") or b""
        filepath = resolved.get("filepath") or ""
        if (not content or len(content) == 0) and filepath and os.path.exists(filepath):
            with open(filepath, "rb") as f:
                resolved["content"] = f.read()
        return resolved

    def process(self, **kwargs) -> ExtractionResult:
        kwargs = self._resolve_file_content(kwargs)
        self.validate(**kwargs)
        result = self.extract(**kwargs)
        result.text = self.clean(result.text)
        return result
