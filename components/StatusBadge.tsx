/**
 * components/StatusBadge.tsx
 *
 * Small pill badge that shows the current agent state in both Sinhala
 * and English, with a corresponding colour-coded indicator dot.
 */

"use client";

import { memo } from "react";
import type { AgentState } from "@/hooks/useVoiceAgent";

interface StatusBadgeProps {
  state: AgentState;
}

const STATE_META: Record<
  AgentState,
  { si: string; en: string; color: string; pulse: boolean }
> = {
  idle: {
    si: "සූදානම්",
    en: "Ready",
    color: "#6b72a8",
    pulse: false,
  },
  listening: {
    si: "සවන් දෙමින්",
    en: "Listening",
    color: "#7c6af7",
    pulse: true,
  },
  thinking: {
    si: "සිතමින්",
    en: "Thinking",
    color: "#a594ff",
    pulse: true,
  },
  speaking: {
    si: "කතා කරමින්",
    en: "Speaking",
    color: "#f7a26a",
    pulse: true,
  },
};

export const StatusBadge = memo(function StatusBadge({
  state,
}: StatusBadgeProps) {
  const meta = STATE_META[state];

  return (
    <div
      className="flex items-center gap-2 rounded-full px-4 py-1.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      aria-live="polite"
      aria-label={`Agent state: ${meta.en}`}
    >
      {/* Indicator dot */}
      <span
        className="relative flex h-2 w-2 items-center justify-center"
        aria-hidden
      >
        {meta.pulse && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: meta.color }}
          />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: meta.color }}
        />
      </span>

      {/* Labels */}
      <span className="font-sinhala text-xs" style={{ color: meta.color }}>
        {meta.si}
      </span>
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        {meta.en}
      </span>
    </div>
  );
});
