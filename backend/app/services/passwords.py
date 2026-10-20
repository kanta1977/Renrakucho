"""パスワードのハッシュ化（標準ライブラリの PBKDF2 を使う）。"""

import hashlib
import hmac
import secrets

from app.config import settings

_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = settings.password_iterations
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"{_ALGO}${rounds}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if algo != _ALGO:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
    return hmac.compare_digest(digest.hex(), digest_hex)


# 番号が存在しないときにも同じ計算をして、かかる時間をそろえるためのもの
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
