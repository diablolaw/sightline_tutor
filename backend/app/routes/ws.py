import asyncio
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.messages import (
    ErrorDetails,
    FrontendMessageAdapter,
    FrontendServerEvent,
)
from app.services.gemini_live import GeminiLiveService, GeminiLiveServiceError
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger("routes.ws")


@router.websocket("/ws/live")
async def live_session_socket(websocket: WebSocket) -> None:
    await websocket.accept()

    backend_session_id = str(uuid4())
    logger.info(
        "websocket_connected",
        extra={"session_id": backend_session_id, "client": str(websocket.client)},
    )

    live_service = GeminiLiveService(session_id=backend_session_id)

    try:
        await live_service.connect()
        await _send_event(
            websocket,
            FrontendServerEvent(
                type="session_started",
                payload={
                    "session_id": backend_session_id,
                    "model": live_service.model,
                    "response_modality": live_service.response_modality,
                },
            ),
        )

        frontend_task = asyncio.create_task(
            _pump_frontend_to_gemini(websocket, live_service),
            name=f"frontend-to-gemini-{backend_session_id}",
        )
        gemini_task = asyncio.create_task(
            _pump_gemini_to_frontend(websocket, live_service),
            name=f"gemini-to-frontend-{backend_session_id}",
        )

        done, pending = await asyncio.wait(
            {frontend_task, gemini_task},
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

        for task in pending:
            await asyncio.gather(task, return_exceptions=True)

        for task in done:
            exc = task.exception()
            if exc:
                raise exc
    except WebSocketDisconnect:
        logger.info(
            "websocket_disconnected",
            extra={"session_id": backend_session_id},
        )
    except GeminiLiveServiceError as exc:
        logger.exception(
            "live_service_error",
            extra={"session_id": backend_session_id},
        )
        await _send_event(
            websocket,
            FrontendServerEvent(
                type="error",
                payload={},
                error=ErrorDetails(
                    code="gemini_live_error",
                    message=str(exc),
                ),
            ),
        )
    except Exception:
        logger.exception(
            "websocket_session_failed",
            extra={"session_id": backend_session_id},
        )
        await _send_event(
            websocket,
            FrontendServerEvent(
                type="error",
                payload={},
                error=ErrorDetails(
                    code="internal_error",
                    message="Unexpected backend error.",
                ),
            ),
        )
    finally:
        await live_service.close()
        await _safe_close_websocket(websocket)
        logger.info(
            "session_closed",
            extra={"session_id": backend_session_id},
        )


async def _pump_frontend_to_gemini(
    websocket: WebSocket,
    live_service: GeminiLiveService,
) -> None:
    while True:
        raw_message = await websocket.receive_json()

        try:
            message = FrontendMessageAdapter.validate_python(raw_message)
        except ValidationError as exc:
            await _send_event(
                websocket,
                FrontendServerEvent(
                    type="error",
                    payload={},
                    error=ErrorDetails(
                        code="invalid_message",
                        message="Malformed websocket message.",
                        details=exc.errors(include_url=False),
                    ),
                ),
            )
            continue

        if message.type == "start_session":
            await _send_event(
                websocket,
                FrontendServerEvent(
                    type="session_started",
                    payload={
                        "session_id": live_service.session_id,
                        "model": live_service.model,
                        "response_modality": live_service.response_modality,
                        "client_session_id": message.payload.client_session_id,
                    },
                ),
            )
        elif message.type == "text_input":
            await live_service.send_text(
                text=message.payload.text,
                end_of_turn=message.payload.end_of_turn,
            )
        elif message.type == "image_frame":
            await live_service.send_image_frame(
                data_base64=message.payload.data_base64,
                mime_type=message.payload.mime_type,
            )
        elif message.type == "audio_chunk":
            await live_service.send_audio_chunk(
                data_base64=message.payload.data_base64,
                mime_type=message.payload.mime_type,
                end_of_stream=message.payload.end_of_stream,
                activity_start=message.payload.activity_start,
                activity_end=message.payload.activity_end,
            )
        elif message.type == "interrupt":
            interrupt_result = await live_service.interrupt()
            await _send_event(
                websocket,
                FrontendServerEvent(
                    type="interrupted",
                    payload=interrupt_result,
                ),
            )
        elif message.type == "end_session":
            await _send_event(
                websocket,
                FrontendServerEvent(
                    type="session_ended",
                    payload={"reason": message.payload.reason or "client_requested"},
                ),
            )
            return


async def _pump_gemini_to_frontend(
    websocket: WebSocket,
    live_service: GeminiLiveService,
) -> None:
    async for event in live_service.receive_events():
        await _send_event(websocket, FrontendServerEvent.model_validate(event))


async def _send_event(websocket: WebSocket, event: FrontendServerEvent) -> None:
    try:
        await websocket.send_json(event.model_dump(mode="json", exclude_none=True))
    except RuntimeError:
        logger.info("websocket_send_skipped_closed_socket")


async def _safe_close_websocket(websocket: WebSocket) -> None:
    try:
        await websocket.close()
    except RuntimeError:
        return
