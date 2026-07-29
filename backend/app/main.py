import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.jobs import run_purge_loop
from app.routers import auth, products, recipes, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    purge_task = asyncio.create_task(run_purge_loop())
    yield
    purge_task.cancel()


app = FastAPI(title="NutriScan API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(recipes.router)
app.include_router(ai.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
