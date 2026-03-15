import base64
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any

from google import genai
from google.genai import types

from app.config import settings
from app.utils.logger import get_logger

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are Sightline Tutor, a focused algebra and homework voice tutor. "
    "Stay on task, explain reasoning clearly, ask short follow-up questions when "
    "needed, and avoid acting like a general-purpose assistant."
)

logger = get_logger("services.gemini_live")


class GeminiLiveServiceError(RuntimeError):
    """Raised when Gemini Live session setup or streaming fails."""


class GeminiLiveService:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.model = settings.gemini_model
        self.response_modality = settings.gemini_response_modality
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._session_cm = None
        self._session = None
        self._audio_chunk_count = 0

    async def connect(self) -> None:
        config_kwargs: dict[str, Any] = {
            "response_modalities": [self.response_modality],
            "system_instruction": DEFAULT_SYSTEM_INSTRUCTION,
            "input_audio_transcription": {},
            "realtime_input_config": types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=True,
                ),
                activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
                turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
            ),
        }
        if self.response_modality == "AUDIO":
            config_kwargs["output_audio_transcription"] = {}

        config = types.LiveConnectConfig(
            **config_kwargs
        )

        try:
            self._session_cm = self._client.aio.live.connect(
                model=self.model,
                config=config,
            )
            self._session = await self._session_cm.__aenter__()
        except Exception as exc:  # pragma: no cover - depends on external API
            raise GeminiLiveServiceError(
                f"Failed to connect to Gemini Live model '{self.model}': {exc}"
            ) from exc

        logger.info(
            "gemini_session_started",
            extra={"session_id": self.session_id, "model": self.model},
        )

    async def send_text(self, text: str, end_of_turn: bool = True) -> None:
        self._ensure_session()
        try:
            await self._session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text=text)],
                ),
                turn_complete=end_of_turn,
            )
        except Exception as exc:  # pragma: no cover - depends on external API
            raise GeminiLiveServiceError(
                f"Failed to send text input to Gemini Live: {exc}"
            ) from exc

    async def send_image_frame(self, data_base64: str, mime_type: str) -> None:
        self._ensure_session()
        try:
            await self._session.send_realtime_input(
                media=types.Blob(
                    data=self._decode_base64(data_base64),
                    mime_type=mime_type,
                )
            )
        except Exception as exc:  # pragma: no cover - depends on external API
            raise GeminiLiveServiceError(
                f"Failed to send image frame to Gemini Live: {exc}"
            ) from exc

    async def send_audio_chunk(
        self,
        data_base64: str | None,
        mime_type: str,
        end_of_stream: bool = False,
        activity_start: bool = False,
        activity_end: bool = False,
    ) -> None:
        self._ensure_session()
        try:
            if activity_start:
                logger.info(
                    "gemini_activity_start_sent",
                    extra={"session_id": self.session_id},
                )
                await self._session.send_realtime_input(activity_start={})

            if data_base64:
                audio_bytes = self._decode_base64(data_base64)
                self._audio_chunk_count += 1
                logger.info(
                    "gemini_audio_chunk_sent",
                    extra={
                        "session_id": self.session_id,
                        "chunk_index": self._audio_chunk_count,
                        "mime_type": mime_type,
                        "bytes": len(audio_bytes),
                    },
                )
                await self._session.send_realtime_input(
                    audio=types.Blob(
                        data=audio_bytes,
                        mime_type=mime_type,
                    )
                )

            if activity_end:
                logger.info(
                    "gemini_activity_end_sent",
                    extra={"session_id": self.session_id},
                )
                await self._session.send_realtime_input(activity_end={})

            if end_of_stream:
                await self._session.send_realtime_input(audio_stream_end=True)
        except Exception as exc:  # pragma: no cover - depends on external API
            raise GeminiLiveServiceError(
                f"Failed to send audio input to Gemini Live: {exc}"
            ) from exc

    async def interrupt(self) -> dict[str, Any]:
        self._ensure_session()

        # The Live API supports barge-in on new user activity. The Python SDK docs do
        # not currently expose a clearly documented explicit "cancel generation now"
        # call, so the backend reports this limitation instead of faking cancellation.
        return {
            "source": "client",
            "forwarded": False,
            "reason": (
                "Explicit cancel is not wired because the current Python Live SDK "
                "docs do not show a dedicated interruption method. Send new user "
                "audio/text to trigger standard barge-in behavior."
            ),
        }

    async def receive_events(self) -> AsyncIterator[dict[str, Any]]:
        self._ensure_session()

        try:
            while True:
                async for message in self._session.receive():
                    for event in self._translate_message(message):
                        yield event
        except Exception as exc:  # pragma: no cover - depends on external API
            raise GeminiLiveServiceError("Gemini Live stream failed.") from exc

    async def close(self) -> None:
        if self._session is not None:
            with suppress(Exception):
                await self._session.close()
            self._session = None

        if self._session_cm is not None:
            with suppress(Exception):
                await self._session_cm.__aexit__(None, None, None)
            self._session_cm = None

        logger.info("gemini_session_closed", extra={"session_id": self.session_id})

    def _ensure_session(self) -> None:
        if self._session is None:
            raise GeminiLiveServiceError("Gemini Live session is not connected.")

    def _translate_message(self, message: Any) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []

        server_content = getattr(message, "server_content", None)
        if server_content is None:
            text = getattr(message, "text", None)
            if text:
                events.append(
                    {
                        "type": "assistant_text",
                        "payload": {"text": text, "source": "message.text"},
                    }
                )
            return events

        if getattr(server_content, "output_transcription", None):
            transcription = getattr(server_content.output_transcription, "text", None)
            if transcription:
                events.append(
                    {
                        "type": "assistant_text",
                        "payload": {
                            "text": transcription,
                            "source": "output_transcription",
                        },
                    }
                )

        if getattr(server_content, "input_transcription", None):
            transcription = getattr(server_content.input_transcription, "text", None)
            if transcription:
                logger.info(
                    "gemini_input_transcription",
                    extra={
                        "session_id": self.session_id,
                        "text": transcription,
                    },
                )
                events.append(
                    {
                        "type": "user_transcript",
                        "payload": {"text": transcription},
                    }
                )

        if getattr(server_content, "interrupted", False):
            events.append(
                {
                    "type": "interrupted",
                    "payload": {"source": "model", "forwarded": True},
                }
            )

        model_turn = getattr(server_content, "model_turn", None)
        parts = getattr(model_turn, "parts", []) or []
        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            if inline_data and getattr(inline_data, "data", None):
                mime_type = getattr(inline_data, "mime_type", "application/octet-stream")
                encoded = base64.b64encode(inline_data.data).decode("utf-8")
                if mime_type.startswith("audio/"):
                    events.append(
                        {
                            "type": "assistant_audio_chunk",
                            "payload": {
                                "mime_type": mime_type,
                                "data_base64": encoded,
                            },
                        }
                    )
                else:
                    events.append(
                        {
                            "type": "model_media",
                            "payload": {
                                "mime_type": mime_type,
                                "data_base64": encoded,
                            },
                        }
                    )

        if getattr(server_content, "turn_complete", False):
            events.append(
                {
                    "type": "turn_complete",
                    "payload": {
                        "reason": getattr(server_content, "turn_complete_reason", None),
                    },
                }
            )

        return events

    @staticmethod
    def _decode_base64(value: str) -> bytes:
        try:
            return base64.b64decode(value, validate=True)
        except Exception as exc:
            raise GeminiLiveServiceError("Invalid base64 media payload.") from exc
