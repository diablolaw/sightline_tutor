"use client";

import type { RefObject } from "react";

type CameraPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  isEnabled: boolean;
  error: string | null;
  onRetry: () => void;
  onToggle: () => void;
};

export function CameraPanel({
  videoRef,
  isReady,
  isEnabled,
  error,
  onRetry,
  onToggle,
}: CameraPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Camera</p>
          <h2 className="panel__title">Homework Preview</h2>
        </div>
        <div className="camera-panel__actions">
          <span className={`badge ${isReady ? "badge--success" : isEnabled ? "badge--muted" : "badge--danger"}`}>
            {isReady ? "Live" : isEnabled ? "Waiting" : "Off"}
          </span>
          <button className="button button--secondary camera-panel__toggle" onClick={onToggle}>
            {isEnabled ? "Stop camera" : "Enable camera"}
          </button>
        </div>
      </div>

      <div className="camera-frame">
        <video ref={videoRef} className="camera-frame__video" muted playsInline autoPlay />
        {!isReady && (
          <div className="camera-frame__overlay">
            <p>
              {error
                ? "Camera unavailable"
                : isEnabled
                  ? "Requesting camera permission..."
                  : "Camera is off"}
            </p>
            {error ? (
              <>
                <p className="subtle">{error}</p>
                <button className="button button--secondary" onClick={onRetry}>
                  Retry camera
                </button>
              </>
            ) : !isEnabled ? (
              <button className="button button--secondary" onClick={onToggle}>
                Enable camera
              </button>
            ) : null}
          </div>
        )}
      </div>

      <p className="subtle">
        Snapshot upload is manual by design. The frontend does not stream continuous video.
      </p>
    </section>
  );
}
