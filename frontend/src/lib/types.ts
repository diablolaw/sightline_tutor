export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "transport_ready"
  | "session_starting"
  | "session_active"
  | "ending"
  | "error";

export type ClientMessage =
  | {
      type: "start_session";
      payload: { client_session_id?: string | null };
    }
  | {
      type: "text_input";
      payload: { text: string; end_of_turn: boolean };
    }
  | {
      type: "image_frame";
      payload: { mime_type: string; data_base64: string };
    }
  | {
      type: "audio_chunk";
      payload: {
        mime_type: string;
        data_base64?: string;
        end_of_stream?: boolean;
        activity_start?: boolean;
        activity_end?: boolean;
      };
    }
  | {
      type: "interrupt";
      payload: { reason?: string | null };
    }
  | {
      type: "end_session";
      payload: { reason?: string | null };
    };

export type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ServerEvent =
  | {
      type: "transport_ready";
      payload: { session_id: string };
      error?: undefined;
    }
  | {
      type: "session_started";
      payload: {
        session_id: string;
        model: string;
        response_modality: string;
        client_session_id?: string | null;
      };
      error?: undefined;
    }
  | {
      type: "user_transcript";
      payload: { text: string };
      error?: undefined;
    }
  | {
      type: "assistant_text";
      payload: { text: string; source?: string };
      error?: undefined;
    }
  | {
      type: "assistant_audio_chunk";
      payload: { mime_type: string; data_base64: string };
      error?: undefined;
    }
  | {
      type: "interrupted";
      payload: Record<string, unknown>;
      error?: undefined;
    }
  | {
      type: "session_ended";
      payload: { reason?: string };
      error?: undefined;
    }
  | {
      type: "turn_complete";
      payload: { reason?: string | null };
      error?: undefined;
    }
  | {
      type: "error";
      payload: Record<string, never>;
      error: ErrorPayload;
    }
  | {
      type: string;
      payload: Record<string, unknown>;
      error?: ErrorPayload;
    };

export type LogLevel = "info" | "success" | "warning" | "error";

export type LogEntry = {
  id: string;
  at: string;
  type: string;
  message: string;
  level: LogLevel;
};

export type SessionSnapshot = {
  backendSessionId?: string;
  model?: string;
  responseModality?: string;
  lastAssistantText?: string;
  lastError?: string;
};

export type AssistantAudioChunk = {
  id: string;
  mimeType: string;
  dataBase64: string;
};
