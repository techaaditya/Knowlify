import re
from urllib.parse import urlparse
import httpx
from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_url, ValidationError

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False


class WebsiteProcessor(BaseSourceProcessor):
    source_type = "website"
    TIMEOUT = 30

    def validate(self, url: str = "", **kwargs) -> None:
        validate_url(url)

    def extract(self, url: str = "", **kwargs) -> ExtractionResult:
        url = validate_url(url)
        try:
            with httpx.Client(timeout=self.TIMEOUT, follow_redirects=True) as client:
                response = client.get(url, headers={"User-Agent": "Knowlify/1.0"})
                response.raise_for_status()
                html = response.text
        except httpx.TimeoutException:
            raise ValidationError("Website request timed out. Please try again.")
        except httpx.HTTPError as e:
            raise ValidationError(f"Failed to fetch website: {e}")

        title = self._extract_title(html) or urlparse(url).netloc
        content = ""

        if HAS_TRAFILATURA:
            extracted = trafilatura.extract(
                html,
                include_comments=False,
                include_tables=True,
                favor_precision=True,
                url=url,
            )
            if extracted:
                content = extracted
                meta = trafilatura.extract_metadata(html)
                if meta and meta.title:
                    title = meta.title

        if not content:
            content = self._fallback_extract(html)

        if not content.strip():
            raise ValidationError("Could not extract meaningful content from this webpage.")

        metadata = {"url": url, "title": title, "domain": urlparse(url).netloc}
        return ExtractionResult(text=content, metadata=metadata, title=title)

    def _extract_title(self, html: str) -> str:
        match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        return match.group(1).strip() if match else ""

    def _fallback_extract(self, html: str) -> str:
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()
