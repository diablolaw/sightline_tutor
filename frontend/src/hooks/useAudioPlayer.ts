"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AssistantAudioChunk } from "@/lib/types";

function parseSampleRate(mimeType: string): number {
  const ratePart = mimeType
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rate="));

  if (!ratePart) {
    return 24000;
  }

  const parsed = Number(ratePart.split("=")[1]);
  return Number.isFinite(parsed) ? parsed : 24000;
}

function pcm16ToAudioBuffer(
  context: AudioContext,
  pcmData: Uint8Array,
  sampleRate: number,
): AudioBuffer {
  const int16 = new Int16Array(
    pcmData.buffer,
    pcmData.byteOffset,
    Math.floor(pcmData.byteLength / 2),
  );
  const audioBuffer = context.createBuffer(1, int16.length, sampleRate);
  const channel = audioBuffer.getChannelData(0);

  for (let index = 0; index < int16.length; index += 1) {
    channel[index] = int16[index] / 32768;
  }

  return audioBuffer;
}

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const ensureContext = useCallback(async () => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }

    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }, []);

  const stop = useCallback(() => {
    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Source may already be finished.
      }
      source.disconnect();
    }
    sourcesRef.current = [];
    nextPlaybackTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  const enqueueChunk = useCallback(
    async (chunk: AssistantAudioChunk) => {
      const context = await ensureContext();
      const bytes = Uint8Array.from(atob(chunk.dataBase64), (character) =>
        character.charCodeAt(0),
      );
      const sampleRate = parseSampleRate(chunk.mimeType);
      const buffer = pcm16ToAudioBuffer(context, bytes, sampleRate);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);

      const startAt = Math.max(context.currentTime, nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current = startAt + buffer.duration;
      source.start(startAt);
      sourcesRef.current.push(source);
      setIsPlaying(true);

      source.onended = () => {
        sourcesRef.current = sourcesRef.current.filter((item) => item !== source);
        if (
          sourcesRef.current.length === 0 &&
          context.currentTime >= nextPlaybackTimeRef.current - 0.05
        ) {
          setIsPlaying(false);
        }
      };
    },
    [ensureContext],
  );

  useEffect(() => {
    return () => {
      stop();
      void contextRef.current?.close();
    };
  }, [stop]);

  return {
    enqueueChunk,
    stop,
    isPlaying,
  };
}
