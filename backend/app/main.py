from fastapi import FastAPI

from app.routers import auth, products, recipes, ai

app = FastAPI(title="NutriScan API", version="0.1.0")

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(recipes.router)
app.include_router(ai.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
