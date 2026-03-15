import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    port: int
    allowed_origins: list[str]
    gemini_model: str
    gemini_response_modality: str

    @classmethod
    def from_env(cls) -> "Settings":
        gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not gemini_api_key:
            raise RuntimeError(
                "Missing GEMINI_API_KEY environment variable. "
                "Set it before starting the backend."
            )

        raw_origins = os.getenv("ALLOWED_ORIGINS", "")
        allowed_origins = [
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        ]

        return cls(
            gemini_api_key=gemini_api_key,
            port=int(os.getenv("PORT", "8080")),
            allowed_origins=allowed_origins or DEFAULT_ALLOWED_ORIGINS,
            gemini_model=os.getenv(
                "GEMINI_MODEL",
                "gemini-live-2.5-flash-preview",
            ).strip(),
            gemini_response_modality=os.getenv(
                "GEMINI_RESPONSE_MODALITY",
                "TEXT",
            ).strip().upper(),
        )


settings = Settings.from_env()
