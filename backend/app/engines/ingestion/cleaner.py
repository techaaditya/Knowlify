import re


def clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\b\d+\b(?=\s*$)", "", text)
    return text.strip()


def normalize_content(text: str) -> str:
    text = clean_text(text)
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)
