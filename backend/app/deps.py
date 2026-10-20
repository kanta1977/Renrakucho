from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.services import auth as auth_service
from app.services.realtime import Broadcaster, get_broadcaster

_bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def get_token(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> str | None:
    return creds.credentials if creds else None


def get_current_user(db: DB, token: Annotated[str | None, Depends(get_token)]) -> User:
    return auth_service.authenticate(db, token)


CurrentUser = Annotated[User, Depends(get_current_user)]
Token = Annotated[str | None, Depends(get_token)]
BroadcasterDep = Annotated[Broadcaster, Depends(get_broadcaster)]
