from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import init_models


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_models()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

# Allow the frontend origins used in development explicitly so the browser
# receives Access-Control-Allow-Origin. In debug mode include 127.0.0.1
# variant as well.
dev_origins = [settings.frontend_origin, "http://127.0.0.1:3000"]
allowed_origins = dev_origins if settings.debug else [settings.frontend_origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=settings.frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
