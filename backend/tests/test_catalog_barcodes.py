import pytest

from app.catalog.barcodes import gtin_check_digit_ok, is_valid_barcode, normalize_barcode


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("034000470693", "0034000470693"),  # 12-digit UPC-A -> 13
        ("3017620422003", "3017620422003"),
        ("0009800800049", "0009800800049"),  # 13 digits w/ leading zeros round-trips
        ("9800800049", "0009800800049"),  # 10 digits -> 13
        ("96385074", "96385074"),  # EAN-8
        ("0000000000017", "00000017"),  # strips zeros, pads <=7 digits to 8
        ("123", "00000123"),
        (" 3017620422003 ", "3017620422003"),
        ("12345678901234", "12345678901234"),  # GTIN-14
        ("ABC-123", "ABC-123"),  # non-numeric left alone (rejected by validation, not here)
        ("", None),
        (None, None),
    ],
)
def test_normalize_barcode(raw, expected):
    assert normalize_barcode(raw) == expected


def test_normalize_is_idempotent():
    for raw in ("034000470693", "123", "3017620422003", "9800800049"):
        once = normalize_barcode(raw)
        assert normalize_barcode(once) == once


@pytest.mark.parametrize("code,ok", [("3017620422003", True), ("00000017", True), ("123", False), ("abc12345", False),
                                     ("0034000470693", True), ("12345678901234", True), ("123456789", False)])
def test_is_valid_barcode(code, ok):
    assert is_valid_barcode(code) is ok


def test_gtin_check_digit():
    assert gtin_check_digit_ok("3017620422003")
    assert gtin_check_digit_ok("5449000000996")
    assert not gtin_check_digit_ok("3017620422004")
