"""設定値。環境変数（CHAT_〜）で上書きできる。"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CHAT_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./chat.db"
    # フロントの URL（複数あるときはカンマ区切り）
    cors_origins: str = "http://localhost:3000"
    board_name: str = "友達の掲示板"
    message_max_length: int = 1000
    username_max_length: int = 20
    # お友達番号の桁数。文字列で保存しているので、後から増やしても今の番号はそのまま使える
    friend_code_digits: int = 6
    page_size_max: int = 100
    # パスワードのハッシュ化の回数（テストでは小さくしている）
    password_iterations: int = 600_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
