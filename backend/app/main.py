from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import auth, friends, rooms, ws
from app.services.chat import ensure_board
from app.services.errors import DomainError


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 今は create_all で十分。本番でスキーマを変えるなら Alembic にする
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        ensure_board(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="れんらく帳 API", version="1.0.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})

    api = APIRouter(prefix="/api")
    api.include_router(auth.router)
    api.include_router(friends.router)
    api.include_router(rooms.router)
    app.include_router(api)
    app.include_router(ws.router)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    return app


app = create_app()
