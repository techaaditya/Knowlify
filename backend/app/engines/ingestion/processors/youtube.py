import re
import httpx
from html import unescape
from defusedxml import ElementTree
from ..base import BaseSourceProcessor, ExtractionResult
from ..validators import validate_youtube_url, ValidationError

INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
INNERTUBE_ANDROID_CLIENT = {"clientName": "ANDROID", "clientVersion": "20.10.38"}

PREFERRED_LANGUAGES = ["en", "en-US", "en-GB", "en-IN", "a.en"]

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api._errors import (
        TranscriptsDisabled,
        NoTranscriptFound,
        VideoUnavailable,
    )
    HAS_YT_API = True
except ImportError:
    HAS_YT_API = False


class YouTubeProcessor(BaseSourceProcessor):
    source_type = "youtube"
    TIMEOUT = 30

    def validate(self, url: str = "", **kwargs) -> None:
        validate_youtube_url(url)

    def extract(self, url: str = "", **kwargs) -> ExtractionResult:
        url = validate_youtube_url(url)
        video_id = self._extract_video_id(url)
        if not video_id:
            raise ValidationError("Could not parse YouTube video ID from URL.")

        meta = self._fetch_video_metadata(url, video_id)
        title = meta.get("title") or f"YouTube Video {video_id}"
        channel = meta.get("author_name", "")

        text, lang, method = self._fetch_transcript(video_id)

        if not text.strip():
            raise ValidationError(
                "No transcript available for this video. "
                "Ensure the video has captions or auto-generated subtitles enabled."
            )

        metadata = {
            "video_id": video_id,
            "url": url,
            "title": title,
            "channel": channel,
            "thumbnail": meta.get("thumbnail_url", f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
            "transcript_language": lang,
            "extraction_method": method,
            "char_count": len(text),
        }
        return ExtractionResult(text=text, metadata=metadata, title=title)

    def _fetch_transcript(self, video_id: str) -> tuple[str, str, str]:
        errors: list[str] = []

        try:
            text, lang = self._fetch_via_innertube_android(video_id)
            if text.strip():
                return text, lang, "innertube_android"
        except Exception as e:
            errors.append(f"innertube: {e}")

        if HAS_YT_API:
            try:
                text, lang = self._fetch_via_transcript_api(video_id)
                if text.strip():
                    return text, lang, "youtube_transcript_api"
            except Exception as e:
                errors.append(f"transcript_api: {e}")

        raise ValidationError(
            "Could not retrieve a transcript for this video. "
            + ("; ".join(errors) if errors else "No captions found.")
        )

    def _fetch_via_innertube_android(self, video_id: str) -> tuple[str, str]:
        with httpx.Client(timeout=self.TIMEOUT) as client:
            response = client.post(
                f"https://www.youtube.com/youtubei/v1/player?key={INNERTUBE_API_KEY}",
                json={
                    "context": {"client": INNERTUBE_ANDROID_CLIENT},
                    "videoId": video_id,
                },
            )
            response.raise_for_status()
            data = response.json()

            status = data.get("playabilityStatus", {}).get("status")
            if status and status != "OK":
                reason = data.get("playabilityStatus", {}).get("reason", "Video unavailable")
                raise ValidationError(reason)

            captions = (
                data.get("captions", {})
                .get("playerCaptionsTracklistRenderer", {})
                .get("captionTracks", [])
            )
            if not captions:
                raise ValidationError("This video has no captions enabled.")

            track = self._pick_caption_track(captions)
            cap_response = client.get(track["baseUrl"])
            cap_response.raise_for_status()

            text = self._parse_timedtext_xml(cap_response.text)
            lang = track.get("languageCode", "unknown")
            return text, lang

    def _fetch_via_transcript_api(self, video_id: str) -> tuple[str, str]:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=PREFERRED_LANGUAGES)
        lines = [snippet.text for snippet in fetched.snippets if snippet.text]
        return " ".join(lines), getattr(fetched, "language_code", "en")

    def _pick_caption_track(self, tracks: list[dict]) -> dict:
        for lang in PREFERRED_LANGUAGES:
            for track in tracks:
                code = track.get("languageCode", "")
                if code == lang or code.startswith(lang):
                    return track
        manual = [t for t in tracks if t.get("kind") != "asr"]
        if manual:
            return manual[0]
        return tracks[0]

    def _parse_timedtext_xml(self, xml_text: str) -> str:
        root = ElementTree.fromstring(xml_text)
        parts: list[str] = []

        for elem in root.iter():
            tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if tag == "p":
                segment = self._extract_element_text(elem)
                if segment and segment not in ("[Music]", "[Applause]", "[Laughter]"):
                    parts.append(segment)
            elif tag == "text" and elem.text:
                parts.append(unescape(elem.text.strip()))

        # Deduplicate consecutive identical segments
        deduped: list[str] = []
        for part in parts:
            if not deduped or deduped[-1] != part:
                deduped.append(part)

        return " ".join(deduped)

    def _extract_element_text(self, elem) -> str:
        texts: list[str] = []
        if elem.text and elem.text.strip():
            texts.append(elem.text.strip())
        for child in elem:
            child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if child_tag == "s":
                if child.text:
                    texts.append(child.text)
            elif child.text:
                texts.append(child.text.strip())
            if child.tail and child.tail.strip():
                texts.append(child.tail.strip())
        return unescape(re.sub(r"\s+", " ", "".join(texts))).strip()

    def _fetch_video_metadata(self, url: str, video_id: str) -> dict:
        try:
            with httpx.Client(timeout=10) as client:
                res = client.get(
                    "https://www.youtube.com/oembed",
                    params={"url": url, "format": "json"},
                )
                if res.status_code == 200:
                    return res.json()
        except Exception:
            pass
        return {
            "title": f"YouTube Video {video_id}",
            "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        }

    def _extract_video_id(self, url: str) -> str | None:
        patterns = [
            r"(?:v=|/v/|youtu\.be/|/embed/)([a-zA-Z0-9_-]{11})",
            r"shorts/([a-zA-Z0-9_-]{11})",
            r"live/([a-zA-Z0-9_-]{11})",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
