import type { ClientMessage, LogEntry, LogLevel, ServerEvent } from "@/lib/types";

export function createSessionSocket(url: string): WebSocket {
  return new WebSocket(url);
}

export function parseServerEvent(raw: string): ServerEvent | null {
  try {
    return JSON.parse(raw) as ServerEvent;
  } catch {
    return null;
  }
}

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function makeLogEntry(
  type: string,
  message: string,
  level: LogLevel = "info",
): LogEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toLocaleTimeString(),
    type,
    message,
    level,
  };
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to convert blob to base64."));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
    reader.readAsDataURL(file);
  });
}
