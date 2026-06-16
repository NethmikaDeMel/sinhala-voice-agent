/**
 * components/VoiceOrb.tsx
 *
 * The central interactive orb that visualises the agent's state:
 *
 *  idle      → subtle purple glow, pulsing slowly
 *  listening → ripple rings expand outward, waveform bars animate
 *  thinking  → spinning gradient rings, "processing" shimmer
 *  speaking  → warm amber glow, waveform bars animate fast
 *
 * Accepts an onClick handler to toggle recording.
 * Disables clicks while thinking or speaking.
 */

"use client";

import { memo } from "react";
import type { AgentState } from "@/hooks/useVoiceAgent";

// ── Props ──────────────────────────────────────────────────────────────────

interface VoiceOrbProps {
  state: AgentState;
  onClick: () => void;
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Seven-bar waveform used during listening + speaking states */
const Waveform = ({ fast }: { fast?: boolean }) => (
  <div
    className="flex items-end justify-center gap-[3px]"
    style={{ height: 36 }}
    aria-hidden
  >
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        className="wave-bar rounded-full"
        style={{
          width: 4,
          height: 36,
          background: fast
            ? "linear-gradient(to top, #f7a26a, #f7d06a)"
            : "linear-gradient(to top, #7c6af7, #a594ff)",
          animationDuration: fast ? "0.5s" : "0.8s",
        }}
      />
    ))}
  </div>
);

/** Spinning double-ring animation used during "thinking" */
const ThinkingRings = () => (
  <>
    {/* Outer ring */}
    <div
      className="animate-spin-slow absolute inset-0 rounded-full"
      style={{
        background:
          "conic-gradient(from 0deg, transparent 60%, #7c6af7, transparent 100%)",
        padding: 2,
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{ background: "#0f1120" }}
      />
    </div>
    {/* Inner counter-ring */}
    <div
      className="animate-spin-reverse absolute inset-[10px] rounded-full"
      style={{
        background:
          "conic-gradient(from 180deg, transparent 60%, #a594ff, transparent 100%)",
        padding: 2,
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{ background: "#0f1120" }}
      />
    </div>
  </>
);

/** Ripple rings that expand outward during "listening" */
const RippleRings = () => (
  <>
    <div
      className="animate-ripple absolute inset-0 rounded-full border-2"
      style={{ borderColor: "rgba(124,106,247,0.4)", animationDelay: "0s" }}
    />
    <div
      className="animate-ripple absolute inset-0 rounded-full border-2"
      style={{
        borderColor: "rgba(124,106,247,0.25)",
        animationDelay: "0.6s",
      }}
    />
    <div
      className="animate-ripple absolute inset-0 rounded-full border-2"
      style={{
        borderColor: "rgba(124,106,247,0.15)",
        animationDelay: "1.2s",
      }}
    />
  </>
);

// ── Orb configs ────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  AgentState,
  {
    label: string;
    sublabel: string;
    bg: string;
    border: string;
    shadow: string;
    cursor: string;
  }
> = {
  idle: {
    label: "ස්පර්ශ කරන්න",
    sublabel: "Tap to speak",
    bg: "linear-gradient(135deg, #161929, #1e2340)",
    border: "rgba(124,106,247,0.35)",
    shadow:
      "0 0 30px 6px rgba(124,106,247,0.25), 0 0 80px 20px rgba(124,106,247,0.08)",
    cursor: "cursor-pointer",
  },
  listening: {
    label: "සවන් දෙමින්…",
    sublabel: "Listening…",
    bg: "linear-gradient(135deg, #1a1535, #251d50)",
    border: "rgba(124,106,247,0.7)",
    shadow:
      "0 0 40px 10px rgba(124,106,247,0.45), 0 0 100px 30px rgba(124,106,247,0.15)",
    cursor: "cursor-pointer",
  },
  thinking: {
    label: "සිතමින්…",
    sublabel: "Thinking…",
    bg: "linear-gradient(135deg, #161929, #1e2340)",
    border: "rgba(124,106,247,0.5)",
    shadow:
      "0 0 35px 8px rgba(124,106,247,0.3), 0 0 90px 25px rgba(124,106,247,0.1)",
    cursor: "cursor-not-allowed",
  },
  speaking: {
    label: "කතා කරමින්…",
    sublabel: "Speaking…",
    bg: "linear-gradient(135deg, #1f1710, #2e1e0a)",
    border: "rgba(247,162,106,0.65)",
    shadow:
      "0 0 40px 10px rgba(247,162,106,0.35), 0 0 100px 30px rgba(247,162,106,0.12)",
    cursor: "cursor-not-allowed",
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export const VoiceOrb = memo(function VoiceOrb({
  state,
  onClick,
}: VoiceOrbProps) {
  const cfg = STATE_CONFIG[state];
  const isInteractive = state === "idle" || state === "listening";
  const showWaveform = state === "listening" || state === "speaking";
  const showThinking = state === "thinking";
  const showRipples = state === "listening";
  const showIdle = state === "idle";

  return (
    <button
      onClick={isInteractive ? onClick : undefined}
      aria-label={cfg.sublabel}
      aria-pressed={state === "listening"}
      disabled={!isInteractive}
      className={[
        "relative flex items-center justify-center",
        "rounded-full select-none outline-none",
        "transition-transform duration-200",
        isInteractive && "hover:scale-105 active:scale-95",
        cfg.cursor,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: 180,
        height: 180,
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        boxShadow: cfg.shadow,
      }}
    >
      {/* ── Decorative rings ── */}
      {showRipples && <RippleRings />}
      {showThinking && <ThinkingRings />}

      {/* ── Idle pulse glow ── */}
      {showIdle && (
        <div
          className="animate-pulse-glow absolute inset-0 rounded-full"
          style={{ opacity: 0.6 }}
        />
      )}

      {/* ── Inner content ── */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {showWaveform ? (
          <Waveform fast={state === "speaking"} />
        ) : showThinking ? (
          /* Animated ellipsis dots */
          <div className="flex gap-1.5" aria-hidden>
            {[0, 0.2, 0.4].map((delay, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-accent"
                style={{
                  backgroundColor: "#7c6af7",
                  animation: `wave-bar 0.8s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </div>
        ) : (
          /* Microphone icon (idle) */
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <rect
              x="9"
              y="2"
              width="6"
              height="11"
              rx="3"
              fill="rgba(165,148,255,0.9)"
            />
            <path
              d="M5 10a7 7 0 0014 0"
              stroke="rgba(165,148,255,0.7)"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            <line
              x1="12"
              y1="17"
              x2="12"
              y2="21"
              stroke="rgba(165,148,255,0.7)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="21"
              x2="15"
              y2="21"
              stroke="rgba(165,148,255,0.7)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
});
