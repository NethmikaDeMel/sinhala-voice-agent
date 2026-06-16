/**
 * components/ErrorToast.tsx
 *
 * Dismissible error notification that slides in from the bottom when
 * the voice agent encounters an issue (mic permission denied, API error…).
 */

"use client";

import { memo } from "react";

interface ErrorToastProps {
  message: string;
  onDismiss: () => void;
}

export const ErrorToast = memo(function ErrorToast({
  message,
  onDismiss,
}: ErrorToastProps) {
  return (
    <div
      className="animate-fade-up flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "rgba(247,122,106,0.12)",
        border: "1px solid rgba(247,122,106,0.3)",
        backdropFilter: "blur(8px)",
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* Warning icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" stroke="#f77a6a" strokeWidth="1.8" />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="13"
          stroke="#f77a6a"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16" r="0.8" fill="#f77a6a" />
      </svg>

      {/* Message */}
      <p className="flex-1 text-sm leading-snug" style={{ color: "#f77a6a" }}>
        {message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
        style={{ color: "#f77a6a" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
});
