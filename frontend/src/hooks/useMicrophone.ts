"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MicrophoneChunk = {
  mimeType: string;
  dataBase64: string;
};

type UseMicrophoneOptions = {
  onChunk: (chunk: MicrophoneChunk) => void | Promise<void>;
  onSpeechStart?: () => void | Promise<void>;
  onSpeechEnd?: () => void | Promise<void>;
};

export function useMicrophone({
  onChunk,
  onSpeechStart,
  onSpeechEnd,
}: UseMicrophoneOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceRef = useRef<GainNode | null>(null);
  const speechActiveRef = useRef(false);
  const silenceFramesRef = useRef(0);
  const speechFramesRef = useRef(0);
  const preSpeechBufferRef = useRef<MicrophoneChunk[]>([]);

  const speechThreshold = 0.03;
  const startFramesToBegin = 2;
  const silenceFramesToEnd = 5;
  const preSpeechFrames = 3;

  const downsampleTo16k = useCallback((input: Float32Array, inputSampleRate: number) => {
    const targetSampleRate = 16000;
    if (inputSampleRate === targetSampleRate) {
      return input;
    }

    const ratio = inputSampleRate / targetSampleRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);

    let outputIndex = 0;
    let inputIndex = 0;

    while (outputIndex < outputLength) {
      const nextInputIndex = Math.min(input.length, Math.round((outputIndex + 1) * ratio));
      let accumulator = 0;
      let count = 0;

      for (let index = inputIndex; index < nextInputIndex; index += 1) {
        accumulator += input[index];
        count += 1;
      }

      output[outputIndex] = count > 0 ? accumulator / count : input[inputIndex] ?? 0;
      outputIndex += 1;
      inputIndex = nextInputIndex;
    }

    return output;
  }, []);

  const encodePcm16 = useCallback((input: Float32Array) => {
    const pcm = new Int16Array(input.length);

    for (let index = 0; index < input.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index]));
      pcm[index] = sample < 0 ? sample * 32768 : sample * 32767;
    }

    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return btoa(binary);
  }, []);

  const teardownAudioGraph = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silenceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    silenceRef.current = null;
  }, []);

  const requestAccess = useCallback(async () => {
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
      setIsReady(true);
      setError(null);
      return streamRef.current;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Microphone access failed.";
      setError(message);
      setIsReady(false);
      throw caughtError;
    }
  }, []);

  const stop = useCallback(() => {
    if (speechActiveRef.current) {
      speechActiveRef.current = false;
      silenceFramesRef.current = 0;
      speechFramesRef.current = 0;
      void onSpeechEnd?.();
    }
    preSpeechBufferRef.current = [];
    teardownAudioGraph();
    void contextRef.current?.close();
    contextRef.current = null;
    setIsStarting(false);
    setIsRecording(false);
    setInputLevel(0);
  }, [onSpeechEnd, teardownAudioGraph]);

  const start = useCallback(async () => {
    try {
      setIsStarting(true);
      const stream = await requestAccess();
      const context = new AudioContext({ sampleRate: 16000 });
      await context.resume();

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silence = context.createGain();
      silence.gain.value = 0;

      processor.onaudioprocess = async (event) => {
        const input = event.inputBuffer.getChannelData(0);
        let sumSquares = 0;
        for (let index = 0; index < input.length; index += 1) {
          const sample = input[index];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / input.length);
        setInputLevel((current) => Math.max(rms, current * 0.82));

        const downsampled = downsampleTo16k(input, context.sampleRate);
        const chunk = {
          mimeType: "audio/pcm;rate=16000",
          dataBase64: encodePcm16(downsampled),
        };

        if (!speechActiveRef.current && rms >= speechThreshold) {
          speechFramesRef.current += 1;
          if (speechFramesRef.current >= startFramesToBegin) {
            speechActiveRef.current = true;
            speechFramesRef.current = 0;
            silenceFramesRef.current = 0;
            await onSpeechStart?.();
            const bufferedChunks = [...preSpeechBufferRef.current, chunk];
            preSpeechBufferRef.current = [];
            for (const bufferedChunk of bufferedChunks) {
              await onChunk(bufferedChunk);
            }
            return;
          }
        } else if (!speechActiveRef.current) {
          speechFramesRef.current = 0;
        }

        if (speechActiveRef.current) {
          if (rms < speechThreshold * 0.55) {
            silenceFramesRef.current += 1;
            if (silenceFramesRef.current >= silenceFramesToEnd) {
              speechActiveRef.current = false;
              silenceFramesRef.current = 0;
              speechFramesRef.current = 0;
              await onSpeechEnd?.();
              preSpeechBufferRef.current = [];
              return;
            }
          } else {
            silenceFramesRef.current = 0;
          }
          await onChunk(chunk);
          return;
        }

        preSpeechBufferRef.current.push(chunk);
        if (preSpeechBufferRef.current.length > preSpeechFrames) {
          preSpeechBufferRef.current.shift();
        }
      };

      source.connect(processor);
      processor.connect(silence);
      silence.connect(context.destination);

      contextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      silenceRef.current = silence;
      speechActiveRef.current = false;
      silenceFramesRef.current = 0;
      speechFramesRef.current = 0;
      preSpeechBufferRef.current = [];
      setIsRecording(true);
      setIsStarting(false);
      setError(null);
      return true;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Microphone start failed.";
      setError(message);
      setIsStarting(false);
      setIsRecording(false);
      setInputLevel(0);
      return false;
    }
  }, [downsampleTo16k, encodePcm16, onChunk, requestAccess]);

  useEffect(() => {
    return () => {
      teardownAudioGraph();
      void contextRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [teardownAudioGraph]);

  return {
    start,
    stop,
    requestAccess,
    inputLevel,
    isStarting,
    isRecording,
    isReady,
    error,
  };
}
