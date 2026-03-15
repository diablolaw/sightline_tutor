"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { config } from "@/lib/config";
import {
  createSessionSocket,
  makeLogEntry,
  parseServerEvent,
  serializeClientMessage,
} from "@/lib/websocket";
import type {
  AssistantAudioChunk,
  ClientMessage,
  ConnectionState,
  LogEntry,
  ServerEvent,
  SessionSnapshot,
} from "@/lib/types";

type UseLiveSessionOptions = {
  onAssistantAudioChunk?: (chunk: AssistantAudioChunk) => void | Promise<void>;
  onSessionEnded?: () => void;
  onInterrupted?: () => void;
  onAssistantText?: (text: string) => void;
  onUserTranscript?: (text: string) => void;
};

export function useLiveSession(options: UseLiveSessionOptions = {}) {
  const socketRef = useRef<WebSocket | null>(null);
  const assistantTurnTextRef = useRef("");
  const assistantTurnCompleteRef = useRef(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({});

  const pushLog = useCallback((entry: LogEntry) => {
    setEventLog((current) => [...current, entry].slice(-config.eventLogLimit));
  }, []);

  const logClientEvent = useCallback(
    (type: string, message: string, level: LogEntry["level"] = "info") => {
      pushLog(makeLogEntry(type, message, level));
    },
    [pushLog],
  );

  const send = useCallback(
    (message: ClientMessage, options?: { suppressClosedLog?: boolean }) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (!options?.suppressClosedLog) {
          pushLog(makeLogEntry("client_error", "WebSocket is not open.", "error"));
        }
        return false;
      }

      socket.send(serializeClientMessage(message));
      return true;
    },
    [pushLog],
  );

  const handleServerEvent = useCallback(
    async (event: ServerEvent) => {
      switch (event.type) {
        case "transport_ready":
          setConnectionState("transport_ready");
          setSnapshot((current) => ({
            ...current,
            backendSessionId: String(event.payload.session_id),
          }));
          pushLog(
            makeLogEntry(
              event.type,
              "Transport connected. Ready to start session.",
              "success",
            ),
          );
          return;
        case "session_started":
          assistantTurnTextRef.current = "";
          assistantTurnCompleteRef.current = true;
          setConnectionState("session_active");
          setSnapshot((current) => ({
            ...current,
            backendSessionId: String(event.payload.session_id),
            model: String(event.payload.model),
            responseModality: String(event.payload.response_modality),
            lastAssistantText: undefined,
          }));
          pushLog(makeLogEntry(event.type, "Tutor session started.", "success"));
          return;
        case "assistant_text": {
          const chunk = String(event.payload.text ?? "");
          if (assistantTurnCompleteRef.current) {
            assistantTurnTextRef.current = chunk;
            assistantTurnCompleteRef.current = false;
          } else {
            assistantTurnTextRef.current += chunk;
          }
          const fullText = assistantTurnTextRef.current.trim();
          options.onAssistantText?.(fullText);
          setSnapshot((current) => ({
            ...current,
            lastAssistantText: fullText,
          }));
          pushLog(makeLogEntry(event.type, chunk, "info"));
          return;
        }
        case "user_transcript":
          options.onUserTranscript?.(String(event.payload.text ?? ""));
          pushLog(
            makeLogEntry(
              event.type,
              `You said: ${String(event.payload.text ?? "")}`,
              "success",
            ),
          );
          return;
        case "assistant_audio_chunk":
          pushLog(makeLogEntry(event.type, "Assistant audio chunk received.", "info"));
          await options.onAssistantAudioChunk?.({
            id: crypto.randomUUID(),
            mimeType: String(event.payload.mime_type ?? "audio/pcm;rate=24000"),
            dataBase64: String(event.payload.data_base64 ?? ""),
          });
          return;
        case "interrupted":
          pushLog(makeLogEntry(event.type, "Tutor interrupted.", "warning"));
          options.onInterrupted?.();
          return;
        case "session_ended":
          assistantTurnTextRef.current = "";
          assistantTurnCompleteRef.current = true;
          setConnectionState("transport_ready");
          pushLog(
            makeLogEntry(
              event.type,
              `Session ended${event.payload.reason ? `: ${String(event.payload.reason)}` : "."}`,
              "warning",
            ),
          );
          options.onSessionEnded?.();
          return;
        case "turn_complete":
          assistantTurnCompleteRef.current = true;
          setSnapshot((current) => ({
            ...current,
            lastAssistantText: assistantTurnTextRef.current.trim() || current.lastAssistantText,
          }));
          pushLog(makeLogEntry(event.type, "Tutor finished the current turn.", "success"));
          return;
        case "error":
          setConnectionState("error");
          setSnapshot((current) => ({
            ...current,
            lastError: event.error?.message ?? "Unknown websocket error.",
          }));
          pushLog(
            makeLogEntry(
              event.type,
              event.error?.message ?? "Unknown websocket error.",
              "error",
            ),
          );
          return;
        default:
          pushLog(makeLogEntry(event.type, "Unhandled event received.", "info"));
      }
    },
    [options, pushLog],
  );

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) {
      return;
    }

    setConnectionState("connecting");
    pushLog(makeLogEntry("connect", `Connecting to ${config.wsUrl}`, "info"));

    const socket = createSessionSocket(config.wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      pushLog(makeLogEntry("socket_open", "WebSocket transport opened.", "success"));
    });

    socket.addEventListener("message", (messageEvent) => {
      const raw = typeof messageEvent.data === "string" ? messageEvent.data : "";
      const parsed = parseServerEvent(raw);
      if (!parsed) {
        pushLog(makeLogEntry("parse_error", "Received invalid JSON from backend.", "error"));
        return;
      }
      void handleServerEvent(parsed);
    });

    socket.addEventListener("close", (event) => {
      socketRef.current = null;
      setConnectionState("disconnected");
      const reasonText = event.reason
        ? ` code=${event.code} reason=${event.reason}`
        : ` code=${event.code}`;
      pushLog(
        makeLogEntry(
          "socket_closed",
          `WebSocket transport closed.${reasonText}`,
          "warning",
        ),
      );
    });

    socket.addEventListener("error", () => {
      setConnectionState("error");
      pushLog(makeLogEntry("socket_error", "WebSocket transport error.", "error"));
    });
  }, [handleServerEvent, pushLog]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setConnectionState("disconnected");
  }, []);

  const startSession = useCallback(() => {
    const didSend = send({
      type: "start_session",
      payload: { client_session_id: crypto.randomUUID() },
    });
    if (!didSend) {
      return;
    }
    setConnectionState("session_starting");
    pushLog(makeLogEntry("start_session", "Requested tutor session start.", "info"));
  }, [pushLog, send]);

  const endSession = useCallback(() => {
    const didSend = send({
      type: "end_session",
      payload: { reason: "frontend_user_requested" },
    });
    if (!didSend) {
      return;
    }
    setConnectionState("ending");
    pushLog(makeLogEntry("end_session", "Requested tutor session end.", "warning"));
  }, [pushLog, send]);

  const sendImageFrame = useCallback(
    (payload: { mime_type: string; data_base64: string }) => {
      const didSend = send({
        type: "image_frame",
        payload,
      });
      if (didSend) {
        pushLog(makeLogEntry("image_frame", "Homework snapshot sent.", "success"));
      }
    },
    [pushLog, send],
  );

  const sendAudioChunk = useCallback(
    (payload: {
      mime_type: string;
      data_base64?: string;
      end_of_stream?: boolean;
      activity_start?: boolean;
      activity_end?: boolean;
    }) => {
      send(
        {
          type: "audio_chunk",
          payload,
        },
        { suppressClosedLog: true },
      );
    },
    [send],
  );

  const sendTextInput = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      send({
        type: "text_input",
        payload: { text: trimmed, end_of_turn: true },
      });
      pushLog(makeLogEntry("text_input", `Sent text: ${trimmed}`, "info"));
    },
    [pushLog, send],
  );

  const interrupt = useCallback(() => {
    const didSend = send({
      type: "interrupt",
      payload: { reason: "frontend_interrupt" },
    });
    if (!didSend) {
      return;
    }
    pushLog(makeLogEntry("interrupt", "Interrupt sent.", "warning"));
  }, [pushLog, send]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  const canStartSession = connectionState === "transport_ready" || connectionState === "error";
  const canEndSession =
    connectionState === "session_active" ||
    connectionState === "session_starting" ||
    connectionState === "ending";

  return useMemo(
    () => ({
      connectionState,
      eventLog,
      snapshot,
      connect,
      disconnect,
      startSession,
      endSession,
      sendImageFrame,
      sendAudioChunk,
      sendTextInput,
      interrupt,
      canStartSession,
      canEndSession,
      logClientEvent,
      isTransportConnected:
        connectionState !== "disconnected" && connectionState !== "connecting",
    }),
    [
      canEndSession,
      canStartSession,
      connect,
      connectionState,
      disconnect,
      endSession,
      eventLog,
      interrupt,
      logClientEvent,
      sendAudioChunk,
      sendImageFrame,
      sendTextInput,
      snapshot,
      startSession,
    ],
  );
}
