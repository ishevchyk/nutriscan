"""Sanitization for rich-text HTML fields (product notes, recipe description).

The mobile app's rich editor submits HTML. Cleaning it on write with a tag
allowlist keeps stored markup limited to what the editor can produce, so any
client (including the future web app) can render it without XSS risk.
"""
import nh3

# Mirrors what the tentap editor toolbar can produce.
_ALLOWED_TAGS = {
    "p", "br",
    "strong", "b", "em", "i", "u", "s",
    "ol", "ul", "li",
    "h1", "h2", "h3",
    "blockquote", "code", "pre",
    "a",
}
_ALLOWED_ATTRIBUTES = {"a": {"href"}}


def sanitize_rich_text(value: str | None) -> str | None:
    if value is None:
        return None
    return nh3.clean(
        value,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )
