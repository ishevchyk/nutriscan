"""Barcode normalization matching Open Food Facts' rule: strip leading zeros,
then pad <=7 digits to 8 and 9-12 digits to 13 (so a 12-digit UPC-A
034000470693 becomes 0034000470693)."""
import re

VALID_LENGTHS = (8, 12, 13, 14)


def normalize_barcode(raw: str | None) -> str | None:
    if raw is None:
        return None
    code = raw.strip()
    if not code.isdigit():
        return code or None  # leave non-numeric values untouched
    code = code.lstrip("0")
    if not code:
        return "0" * 8
    if len(code) <= 7:
        return code.zfill(8)
    if 9 <= len(code) <= 12:
        return code.zfill(13)
    return code


def is_valid_barcode(code: str | None) -> bool:
    return isinstance(code, str) and bool(re.fullmatch(r"\d+", code)) and len(code) in VALID_LENGTHS


def gtin_check_digit_ok(code: str) -> bool:
    """GTIN mod-10 check. Callers log a warning on False; never reject on it
    (OFF holds products with bad check digits, e.g. in-store codes)."""
    if not code.isdigit() or len(code) < 2:
        return False
    body, check = code[:-1], int(code[-1])
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    return (10 - total % 10) % 10 == check
