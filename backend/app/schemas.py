"""API の入出力の形。"""

import re
import unicodedata
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints, field_serializer

from app.config import settings


def normalize_name(v: object) -> object:
    """全角・半角をそろえ、連続する空白（全角スペースも）を1つにする。"""
    if not isinstance(v, str):
        return v
    v = unicodedata.normalize("NFKC", v)
    return re.sub(r"\s+", " ", v).strip()


Username = Annotated[
    str,
    BeforeValidator(normalize_name),
    StringConstraints(min_length=1, max_length=settings.username_max_length, pattern=r"^[^\x00-\x1f\x7f]+$"),
]


def normalize_code(v: object) -> object:
    """"482-915" や "４８２９１５" を "482915" にする。"""
    if not isinstance(v, str):
        return v
    return re.sub(r"\D", "", unicodedata.normalize("NFKC", v))


FriendCode = Annotated[str, BeforeValidator(normalize_code), StringConstraints(pattern=r"^\d{6,12}$")]
PASSWORD_MIN_LENGTH = 8


def check_password(v: str) -> str:
    """半角8〜64文字で、英字と数字を両方含むこと。"""
    if not 8 <= len(v) <= 64:
        raise ValueError("password must be 8-64 characters")
    if not all("!" <= c <= "~" for c in v):
        raise ValueError("password must use half-width letters, digits and symbols only")
    if not (any(c.isalpha() for c in v) and any(c.isdigit() for c in v)):
        raise ValueError("password must contain both letters and digits")
    return v


Password = Annotated[str, AfterValidator(check_password)]
MessageContent = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=settings.message_max_length),
]


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", check_fields=False)
    def _ser_dt(self, v: datetime) -> str:
        # SQLite はタイムゾーンを落とすので UTC を付け直す
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()


class RegisterRequest(BaseModel):
    username: Username
    password: Password


class ResumeRequest(BaseModel):
    friend_code: FriendCode
    # 入るときはルールの確認をしない（合っているかどうかだけ見る）
    password: str = Field(min_length=1, max_length=64)


class UserOut(_ORM):
    """他の人に見せる形。お友達番号は含めない。"""

    id: int
    username: str


class MeOut(UserOut):
    """自分の情報。自分の番号はここでだけ返す。"""

    friend_code: str


class LoginResponse(BaseModel):
    token: str
    user: MeOut


class MessageCreate(BaseModel):
    content: MessageContent
    # 掲示板の宛先（任意）
    mention_user_id: int | None = None


class MessageOut(_ORM):
    id: int
    room_id: int
    user: UserOut
    content: str
    mention: UserOut | None = None
    created_at: datetime


class MessagePage(BaseModel):
    items: list[MessageOut] = Field(description="Oldest first")
    has_more: bool = Field(description="True if older messages exist before items[0]")


class RoomOut(BaseModel):
    id: int
    kind: Literal["board", "direct"]
    title: str = Field(description="Board name, or the friend's name for a direct room")
    friend: UserOut | None = None


class FriendAdd(BaseModel):
    friend_code: FriendCode


class ConversationSummary(BaseModel):
    room_id: int
    unread: int
    mentions: int = Field(0, description="Board only: unread posts addressed to you")
    last_message: MessageOut | None


class FriendOut(ConversationSummary):
    user: UserOut
    since: datetime = Field(description="When you became friends (tells same-name friends apart)")

    @field_serializer("since")
    def _ser_since(self, v: datetime) -> str:
        return (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat()


class HomeOut(BaseModel):
    me: MeOut
    board: ConversationSummary
    friends: list[FriendOut]
