from fastapi import APIRouter, status

from app.deps import DB, CurrentUser, Token
from app.schemas import LoginResponse, MeOut, RegisterRequest, ResumeRequest
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DB):
    """はじめて使う：新しいお友達番号を発行する。"""
    token, user = auth_service.register(db, body.username, body.password)
    return LoginResponse(token=token, user=MeOut.model_validate(user))


@router.post("/resume", response_model=LoginResponse)
def resume(body: ResumeRequest, db: DB):
    """前にも使った：番号とパスワードで入る。"""
    token, user = auth_service.resume(db, body.friend_code, body.password)
    return LoginResponse(token=token, user=MeOut.model_validate(user))


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DB, user: CurrentUser, token: Token):
    auth_service.logout(db, token)  # type: ignore[arg-type]
