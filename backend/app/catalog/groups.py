"""OFF category tag -> NutriScan system group. Ordered most-specific first: the
first rule whose tag is on the product wins (OFF's tag order isn't reliable).
Names must match the seeded system groups. Phase 6 reuses this."""

CATEGORY_TO_GROUP: list[tuple[str, str]] = [
    # Sweets
    ("en:sweet-spreads", "Sweets"), ("en:chocolates", "Sweets"), ("en:candies", "Sweets"),
    ("en:confectioneries", "Sweets"), ("en:desserts", "Sweets"), ("en:cakes", "Sweets"),
    ("en:sweet-snacks", "Sweets"), ("en:ice-creams-and-sorbets", "Sweets"),
    # Dairy
    ("en:dairies", "Dairy"), ("en:milks", "Dairy"), ("en:cheeses", "Dairy"), ("en:yogurts", "Dairy"),
    ("en:fermented-milk-products", "Dairy"), ("en:butters", "Dairy"), ("en:creams", "Dairy"),
    # Meat & Fish
    ("en:meats", "Meat & Fish"), ("en:fishes", "Meat & Fish"), ("en:seafood", "Meat & Fish"),
    ("en:poultries", "Meat & Fish"), ("en:sausages", "Meat & Fish"), ("en:meats-and-their-products", "Meat & Fish"),
    # Beverages
    ("en:beverages", "Beverages"), ("en:waters", "Beverages"), ("en:sodas", "Beverages"),
    ("en:juices-and-nectars", "Beverages"), ("en:coffees", "Beverages"), ("en:teas", "Beverages"),
    # Fruits / Vegetables
    ("en:fruits", "Fruits"), ("en:fruits-and-vegetables-based-foods", "Fruits"), ("en:fresh-fruits", "Fruits"),
    ("en:vegetables", "Vegetables"), ("en:fresh-vegetables", "Vegetables"),
    ("en:legumes", "Vegetables"),
    # Grains
    ("en:breads", "Grains"), ("en:pastas", "Grains"), ("en:rices", "Grains"), ("en:cereals-and-potatoes", "Grains"),
    ("en:cereals-and-their-products", "Grains"), ("en:flours", "Grains"), ("en:noodles", "Grains"),
    # Condiments
    ("en:sauces", "Condiments"), ("en:condiments", "Condiments"), ("en:spices", "Condiments"),
    ("en:oils", "Condiments"), ("en:vinegars", "Condiments"), ("en:fats", "Condiments"),
    # Breakfast / Snacks (generic, last)
    ("en:breakfast-cereals", "Breakfast"), ("en:breakfasts", "Breakfast"), ("en:spreads", "Breakfast"),
    ("en:snacks", "Snacks"), ("en:salty-snacks", "Snacks"), ("en:biscuits-and-cakes", "Snacks"),
    ("en:biscuits", "Snacks"),
]


def suggest_group(categories_tags: list[str] | None) -> str | None:
    tags = set(categories_tags or [])
    for tag, group in CATEGORY_TO_GROUP:
        if tag in tags:
            return group
    return None
