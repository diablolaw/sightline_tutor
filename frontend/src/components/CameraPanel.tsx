"use client";

import type { RefObject } from "react";

type CameraPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
  onRetry: () => void;
};

export function CameraPanel({ videoRef, isReady, error, onRetry }: CameraPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Camera</p>
          <h2 className="panel__title">Homework Preview</h2>
        </div>
        <span className={`badge ${isReady ? "badge--success" : "badge--muted"}`}>
          {isReady ? "Live" : "Waiting"}
        </span>
      </div>

      <div className="camera-frame">
        <video ref={videoRef} className="camera-frame__video" muted playsInline autoPlay />
        {!isReady && (
          <div className="camera-frame__overlay">
            <p>{error ? "Camera unavailable" : "Requesting camera permission..."}</p>
            {error ? (
              <>
                <p className="subtle">{error}</p>
                <button className="button button--secondary" onClick={onRetry}>
                  Retry camera
                </button>
              </>
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
