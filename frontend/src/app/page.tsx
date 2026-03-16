"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CameraPanel } from "@/components/CameraPanel";
import { EventLog } from "@/components/EventLog";
import { MicControls } from "@/components/MicControls";
import { SessionControls } from "@/components/SessionControls";
import { StatusPanel } from "@/components/StatusPanel";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLiveSession } from "@/hooks/useLiveSession";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useWebcamCapture } from "@/hooks/useWebcamCapture";

export default function Page() {
  const webcam = useWebcamCapture();
  const audioPlayer = useAudioPlayer();
  const micChunkCountRef = useRef(0);
  const speechTurnActiveRef = useRef(false);
  const [showDebug, setShowDebug] = useState(false);

  const session = useLiveSession({
    onAssistantAudioChunk: audioPlayer.enqueueChunk,
    onInterrupted: audioPlayer.stop,
    onSessionEnded: () => {
      speechTurnActiveRef.current = false;
      audioPlayer.stop();
    },
  });
  const isSessionActive = session.connectionState === "session_active";

  const microphone = useMicrophone({
    onChunk: async ({ mimeType, dataBase64 }) => {
      micChunkCountRef.current += 1;
      if (micChunkCountRef.current === 1) {
        session.logClientEvent("mic_chunk", "First microphone audio chunk captured.", "success");
      } else if (micChunkCountRef.current % 10 === 0) {
        session.logClientEvent(
          "mic_chunk",
          `Captured ${micChunkCountRef.current} microphone chunks.`,
          "info",
        );
      }
      session.sendAudioChunk({
        mime_type: mimeType,
        data_base64: dataBase64,
      });
    },
    onSpeechStart: async () => {
      if (speechTurnActiveRef.current) {
        return;
      }
      speechTurnActiveRef.current = true;
      audioPlayer.stop();
      session.sendAudioChunk({
        mime_type: "audio/pcm;rate=16000",
        activity_start: true,
      });
      session.logClientEvent("mic_activity_start", "Detected speech start.", "info");
    },
    onSpeechEnd: async () => {
      if (!speechTurnActiveRef.current) {
        return;
      }
      speechTurnActiveRef.current = false;
      session.sendAudioChunk({
        mime_type: "audio/pcm;rate=16000",
        activity_end: true,
      });
      session.logClientEvent("mic_turn_end", "Detected end of speech for this turn.", "info");
    },
  });

  const handleCapture = useCallback(async () => {
    const frame = await webcam.captureFrame();
    if (!frame) {
      return;
    }
    session.sendImageFrame({
      mime_type: frame.mimeType,
      data_base64: frame.dataBase64,
    });
    session.sendTextInput(
      "I just shared a homework image. Briefly acknowledge what you can see, then wait for my question.",
    );
  }, [session, webcam]);

  const toggleCamera = useCallback(async () => {
    if (webcam.isEnabled) {
      webcam.stopCamera();
      return;
    }
    await webcam.startCamera();
  }, [webcam]);

  const toggleMic = useCallback(async () => {
    if (microphone.isRecording) {
      session.logClientEvent("mic_stop", "Stopping microphone capture.", "warning");
      microphone.stop();
      session.logClientEvent(
        "mic_chunk_total",
        `Microphone captured ${micChunkCountRef.current} chunks in this turn.`,
        "info",
      );
      return;
    }
    micChunkCountRef.current = 0;
    session.logClientEvent("mic_start", "Starting microphone capture.", "info");
    const started = await microphone.start();
    if (!started) {
      session.logClientEvent(
        "mic_error",
        microphone.error ?? "Microphone failed to start.",
        "error",
      );
      return;
    }
    session.logClientEvent("mic_listening", "Microphone capture started.", "success");
  }, [microphone, session]);

  const handleEndSession = useCallback(() => {
    microphone.stop();
    speechTurnActiveRef.current = false;
    session.sendAudioChunk({
      mime_type: "audio/pcm;rate=16000",
      end_of_stream: true,
    });
    audioPlayer.stop();
    session.endSession();
  }, [audioPlayer, microphone, session]);

  useEffect(() => {
    if (session.connectionState === "disconnected") {
      session.connect();
    }
  }, [session]);

  useEffect(() => {
    if (session.connectionState !== "session_active" && microphone.isRecording) {
      microphone.stop();
    }
  }, [microphone, session.connectionState]);

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">SightLine Tutor</p>
        <h1>Live voice algebra tutoring with camera snapshots</h1>
        <p className="hero__body">
          Point the camera at a homework problem, capture a still image, speak to the tutor,
          and get spoken help in real time.
        </p>
      </header>

      <div className="workspace">
        <section className="workspace__column">
          <CameraPanel
            videoRef={webcam.videoRef}
            isReady={webcam.isReady}
            isEnabled={webcam.isEnabled}
            error={webcam.error}
            onRetry={webcam.startCamera}
            onToggle={toggleCamera}
          />

          <SessionControls
            connectionState={session.connectionState}
            canStartSession={session.canStartSession}
            canEndSession={session.canEndSession}
            canCapture={webcam.isReady && isSessionActive}
            onStartSession={session.startSession}
            onEndSession={handleEndSession}
            onCaptureImage={handleCapture}
          />
        </section>

        <section className="workspace__column">
          <StatusPanel
            connectionState={session.connectionState}
            lastAssistantText={session.snapshot.lastAssistantText}
            isCameraReady={webcam.isReady}
            isMicReady={microphone.isReady}
            isMicRecording={microphone.isRecording}
            isAudioPlaying={audioPlayer.isPlaying}
          />

          <MicControls
            inputLevel={microphone.inputLevel}
            isStarting={microphone.isStarting}
            isRecording={microphone.isRecording}
            isReady={microphone.isReady}
            error={microphone.error}
            disabled={!isSessionActive}
            onToggle={toggleMic}
          />

          <section className="panel panel--debug">
            <button
              type="button"
              className="debug-toggle"
              onClick={() => setShowDebug((current) => !current)}
            >
              <span>
                <span className="eyebrow">Debug</span>
                <span className="debug-toggle__title">Technical details</span>
              </span>
              <span className="badge badge--muted">
                {showDebug ? "Hide" : "Show"}
              </span>
            </button>

            {showDebug ? (
              <div className="debug-stack">
                <dl className="status-list">
                  <div className="status-list__row">
                    <dt>Connection</dt>
                    <dd>{session.connectionState}</dd>
                  </div>
                  <div className="status-list__row">
                    <dt>Backend session</dt>
                    <dd>{session.snapshot.backendSessionId ?? "Not assigned"}</dd>
                  </div>
                  <div className="status-list__row">
                    <dt>Model</dt>
                    <dd>{session.snapshot.model ?? "Not started"}</dd>
                  </div>
                  <div className="status-list__row">
                    <dt>Response mode</dt>
                    <dd>{session.snapshot.responseModality ?? "Unknown"}</dd>
                  </div>
                </dl>
                <EventLog events={session.eventLog} />
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
