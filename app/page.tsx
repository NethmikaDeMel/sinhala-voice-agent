/**
 * app/page.tsx
 *
 * Main page of the Sinhala Voice Agent application.
 *
 * Layout (top → bottom, centred):
 *  ┌─────────────────────────────────┐
 *  │         Header / brand          │
 *  │                                 │
 *  │     [ Status badge ]            │
 *  │                                 │
 *  │     ( Voice Orb button )        │
 *  │                                 │
 *  │   State label + hint text       │
 *  │                                 │
 *  │  ┌───────────────────────────┐  │
 *  │  │   Transcript Panel        │  │
 *  │  └───────────────────────────┘  │
 *  │                                 │
 *  │   [ Error toast? ]              │
 *  │   [ Clear history link ]        │
 *  │                                 │
 *  │         Footer                  │
 *  └─────────────────────────────────┘
 *
 * This is a Client Component because it directly uses browser APIs via
 * the useVoiceAgent hook.
 */

"use client";

import { useCallback } from "react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { VoiceOrb } from "@/components/VoiceOrb";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorToast } from "@/components/ErrorToast";

// ── Label copy per state ───────────────────────────────────────────────────

const STATE_LABELS: Record<
  string,
  { primary: string; hint: string }
> = {
  idle: {
    primary: "කතා කිරීමට ස්පර්ශ කරන්න",
    hint: "Tap the orb, speak in Sinhala, then tap again to send",
  },
  listening: {
    primary: "ඔබ කතා කරන්න…",
    hint: "Speaking... tap again when finished",
  },
  thinking: {
    primary: "AI සිතමින් සිටී",
    hint: "Gemini is composing a response in Sinhala…",
  },
  speaking: {
    primary: "AI කතා කරයි",
    hint: "ElevenLabs is synthesising the audio reply…",
  },
};

// ── Background radial gradient particles ──────────────────────────────────

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* Top-left purple nebula */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: 600,
          height: 600,
          background:
            "radial-gradient(ellipse, rgba(90,75,209,0.18) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      {/* Bottom-right warm glow */}
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-10%",
          width: 500,
          height: 500,
          background:
            "radial-gradient(ellipse, rgba(247,162,106,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
      {/* Center subtle glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          background:
            "radial-gradient(ellipse, rgba(124,106,247,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const {
    agentState,
    interimTranscript,
    history,
    error,
    toggleListening,
    clearHistory,
  } = useVoiceAgent();

  const labels = STATE_LABELS[agentState] ?? STATE_LABELS.idle;

  const handleDismissError = useCallback(() => {
    // The hook resets error on next action; here we just trigger clearHistory
    // which also clears the error state.
    // For a non-destructive dismiss we could use local state, but clearHistory
    // is the natural UX flow: after an error, reset and start fresh.
    clearHistory();
  }, [clearHistory]);

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center"
      style={{ background: "#07080f" }}
    >
      {/* Ambient background */}
      <BackgroundGlow />

      {/* ── Main content ── */}
      <main
        className="relative z-10 flex w-full max-w-lg flex-col items-center gap-8 px-6 py-12"
      >
        {/* ── Header ── */}
        <header className="flex flex-col items-center gap-2 text-center">
          {/* Logo mark */}
          <div
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #3d3480 0%, #5a4bd1 100%)",
              boxShadow: "0 0 20px 4px rgba(90,75,209,0.35)",
            }}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
                fill="rgba(165,148,255,0.15)"
                stroke="rgba(165,148,255,0.8)"
                strokeWidth="1.5"
              />
              <path
                d="M8 12.5c0-2.21 1.79-4 4-4s4 1.79 4 4"
                stroke="rgba(165,148,255,0.9)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="9" r="1.2" fill="rgba(165,148,255,0.9)" />
            </svg>
          </div>

          <h1
            className="font-sinhala text-2xl font-semibold tracking-tight"
            style={{ color: "#e8eaff" }}
            lang="si"
          >
            සිංහල කටහඬ සහායකයා
          </h1>
          <p
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: "#3d4470" }}
          >
            Sinhala Voice Agent · AI Powered
          </p>
        </header>

        {/* ── Status badge ── */}
        <StatusBadge state={agentState} />

        {/* ── Orb + label ── */}
        <div className="flex flex-col items-center gap-6">
          <VoiceOrb state={agentState} onClick={toggleListening} />

          <div className="flex flex-col items-center gap-1 text-center">
            <p
              className="font-sinhala text-base font-medium"
              style={{ color: "#c8ccf5" }}
              lang="si"
            >
              {labels.primary}
            </p>
            <p
              className="max-w-[260px] text-xs leading-snug"
              style={{ color: "#3d4470" }}
            >
              {labels.hint}
            </p>
          </div>
        </div>

        {/* ── Transcript panel ── */}
        <section
          className="w-full rounded-2xl p-4"
          style={{
            background: "rgba(15,17,32,0.8)",
            border: "1px solid #1e2340",
            backdropFilter: "blur(12px)",
          }}
          aria-label="Conversation"
        >
          {/* Panel header */}
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="font-sinhala text-xs font-medium"
              style={{ color: "#6b72a8" }}
            >
              සංවාද ඉතිහාසය
              <span
                className="ml-2 font-sans text-[10px] uppercase tracking-widest"
                style={{ color: "#3d4470" }}
              >
                Conversation
              </span>
            </h2>

            {/* Clear button — only show when there's history */}
            {history.length > 0 && agentState === "idle" && (
              <button
                onClick={clearHistory}
                className="rounded-md px-2 py-1 text-[11px] transition-colors hover:opacity-70"
                style={{ color: "#6b72a8" }}
                aria-label="Clear conversation history"
              >
                Clear ✕
              </button>
            )}
          </div>

          <TranscriptPanel
            interimTranscript={interimTranscript}
            history={history}
            isListening={agentState === "listening"}
          />
        </section>

        {/* ── Error toast ── */}
        {error && (
          <ErrorToast message={error} onDismiss={handleDismissError} />
        )}

        {/* ── Tech stack chips ── */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "Deepgram Whisper · STT",
            "Gemini 1.5 Flash · LLM",
            "ElevenLabs · TTS",
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#3d4470",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 w-full pb-6 text-center"
        style={{ color: "#1e2340" }}
      >
        <p className="text-[11px]">
          සෑම කතාවක්ම ශ්‍රී ලංකාවේ භාෂාවෙන් ·{" "}
          <span className="opacity-60">Every conversation in the language of Sri Lanka</span>
        </p>
      </footer>
    </div>
  );
}
