"""登録とログイン。

番号は友達に教えるものなので、本人確認はパスワードで行う。
"""

import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuthToken, User
from app.services import chat
from app.services.errors import NotFound, Unauthorized
from app.services.passwords import DUMMY_HASH, hash_password, verify_password

_MAX_TRIES = 20


def _new_friend_code(db: Session) -> str:
    """番号をランダムに作る（連番だと利用者数や登録順が分かってしまうため）。"""
    digits = settings.friend_code_digits
    for _ in range(_MAX_TRIES):
        # 先頭が0にならないようにする
        code = str(secrets.randbelow(9 * 10 ** (digits - 1)) + 10 ** (digits - 1))
        if db.scalar(select(User.id).where(User.friend_code == code)) is None:
            return code
    raise RuntimeError("friend number space is nearly full: raise CHAT_FRIEND_CODE_DIGITS")


def _issue_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token=token, user_id=user.id))
    db.commit()
    return token


def register(db: Session, username: str, password: str) -> tuple[str, User]:
    user = User(username=username, friend_code=_new_friend_code(db), password_hash=hash_password(password))
    db.add(user)
    db.flush()
    chat.join_board(db, user.id)
    return _issue_token(db, user), user


def resume(db: Session, friend_code: str, password: str) -> tuple[str, User]:
    user = db.scalar(select(User).where(User.friend_code == friend_code))
    # 番号違いでもパスワード違いでも同じ返事にする（番号の有無を探られないように）
    ok = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if user is None or not ok:
        raise Unauthorized("番号かパスワードがちがいます。もう一度お確かめください")
    return _issue_token(db, user), user


def find_by_code(db: Session, friend_code: str) -> User:
    user = db.scalar(select(User).where(User.friend_code == friend_code))
    if user is None:
        raise NotFound("その番号の方は見つかりませんでした。番号をもう一度お確かめください")
    return user


def authenticate(db: Session, token: str | None) -> User:
    if not token:
        raise Unauthorized("もう一度、はじめの画面からお入りください")
    row = db.get(AuthToken, token)
    if row is None:
        raise Unauthorized("もう一度、はじめの画面からお入りください")
    return row.user


def logout(db: Session, token: str) -> None:
    row = db.get(AuthToken, token)
    if row:
        db.delete(row)
        db.commit()
