from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter


class StartSessionPayload(BaseModel):
    client_session_id: str | None = None


class TextInputPayload(BaseModel):
    text: str = Field(min_length=1)
    end_of_turn: bool = True


class ImageFramePayload(BaseModel):
    mime_type: str = Field(min_length=1)
    data_base64: str = Field(min_length=1)


class AudioChunkPayload(BaseModel):
    mime_type: str = Field(default="audio/pcm", min_length=1)
    data_base64: str = Field(min_length=1)
    end_of_stream: bool = False
    activity_start: bool = False
    activity_end: bool = False


class InterruptPayload(BaseModel):
    reason: str | None = None


class EndSessionPayload(BaseModel):
    reason: str | None = None


class StartSessionMessage(BaseModel):
    type: Literal["start_session"]
    payload: StartSessionPayload = Field(default_factory=StartSessionPayload)


class TextInputMessage(BaseModel):
    type: Literal["text_input"]
    payload: TextInputPayload


class ImageFrameMessage(BaseModel):
    type: Literal["image_frame"]
    payload: ImageFramePayload


class AudioChunkMessage(BaseModel):
    type: Literal["audio_chunk"]
    payload: AudioChunkPayload


class InterruptMessage(BaseModel):
    type: Literal["interrupt"]
    payload: InterruptPayload = Field(default_factory=InterruptPayload)


class EndSessionMessage(BaseModel):
    type: Literal["end_session"]
    payload: EndSessionPayload = Field(default_factory=EndSessionPayload)


FrontendMessage = Annotated[
    Union[
        StartSessionMessage,
        TextInputMessage,
        ImageFrameMessage,
        AudioChunkMessage,
        InterruptMessage,
        EndSessionMessage,
    ],
    Field(discriminator="type"),
]

FrontendMessageAdapter = TypeAdapter(FrontendMessage)


class ErrorDetails(BaseModel):
    code: str
    message: str
    details: Any | None = None


class FrontendServerEvent(BaseModel):
    type: str
    payload: dict[str, Any]
    error: ErrorDetails | None = None
