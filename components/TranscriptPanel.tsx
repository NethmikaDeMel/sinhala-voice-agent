/**
 * components/TranscriptPanel.tsx
 *
 * Displays:
 *  1. The live interim transcript (dim text, updating in real time as Deepgram
 *     streams partial results)
 *  2. The full conversation history in a chat-bubble layout
 *     - User turns: right-aligned, indigo bubble
 *     - Assistant turns: left-aligned, dark surface bubble
 *
 * Auto-scrolls to the latest message whenever history changes.
 */

"use client";

import { useEffect, useRef, memo } from "react";
import type { ConversationTurn } from "@/hooks/useVoiceAgent";

// ── Props ──────────────────────────────────────────────────────────────────

interface TranscriptPanelProps {
  interimTranscript: string;
  history: ConversationTurn[];
  isListening: boolean;
}

// ── Chat bubble ────────────────────────────────────────────────────────────

const ChatBubble = memo(function ChatBubble({
  turn,
  index,
}: {
  turn: ConversationTurn;
  index: number;
}) {
  const isUser = turn.role === "user";

  return (
    <div
      key={index}
      className={`animate-fade-up flex ${isUser ? "justify-end" : "justify-start"}`}
      style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
    >
      {/* Avatar dot for assistant */}
      {!isUser && (
        <div
          className="mr-2 mt-1 h-6 w-6 shrink-0 rounded-full"
          style={{
            background: "linear-gradient(135deg, #7c6af7, #a594ff)",
            boxShadow: "0 0 10px 2px rgba(124,106,247,0.3)",
          }}
          aria-hidden
        />
      )}

      <div
        className="max-w-[80%] rounded-2xl px-4 py-3"
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, #3d3480, #5a4bd1)",
                borderBottomRightRadius: 4,
                boxShadow: "0 2px 12px rgba(90,75,209,0.3)",
              }
            : {
                background: "#161929",
                border: "1px solid #1e2340",
                borderBottomLeftRadius: 4,
              }
        }
      >
        {/* Role label */}
        <p
          className="mb-1 text-[10px] font-medium uppercase tracking-widest"
          style={{ color: isUser ? "rgba(255,255,255,0.45)" : "#6b72a8" }}
        >
          {isUser ? "ඔබ" : "සහායකයා"}
        </p>

        {/* Message text in Sinhala font */}
        <p
          className="font-sinhala text-[15px] leading-relaxed"
          style={{ color: isUser ? "#f0edff" : "#c8ccf5" }}
          lang="si"
        >
          {turn.text}
        </p>
      </div>

      {/* Avatar dot for user */}
      {isUser && (
        <div
          className="ml-2 mt-1 h-6 w-6 shrink-0 rounded-full"
          style={{ background: "#3d4470" }}
          aria-hidden
        />
      )}
    </div>
  );
});

// ── Component ──────────────────────────────────────────────────────────────

export const TranscriptPanel = memo(function TranscriptPanel({
  interimTranscript,
  history,
  isListening,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, interimTranscript]);

  const isEmpty = history.length === 0 && !interimTranscript;

  return (
    <div
      className="scrollbar-thin flex w-full flex-col gap-3 overflow-y-auto"
      style={{
        maxHeight: 400,
        minHeight: 120,
        padding: "0 4px",
      }}
      aria-live="polite"
      aria-label="Conversation transcript"
      role="log"
    >
      {isEmpty ? (
        /* Empty state */
        <div className="flex h-24 items-center justify-center">
          <p
            className="font-sinhala text-center text-sm"
            style={{ color: "#3d4470" }}
            lang="si"
          >
            ඔබේ කටහඬ ආරම්භ කිරීමට බොත්තම ස්පර්ශ කරන්න
            <br />
            <span className="mt-1 block font-sans text-xs" lang="en">
              Tap the orb to begin speaking
            </span>
          </p>
        </div>
      ) : (
        <>
          {/* Render completed conversation turns */}
          {history.map((turn, i) => (
            <ChatBubble key={i} turn={turn} index={i} />
          ))}

          {/* Live interim transcript */}
          {interimTranscript && (
            <div className="flex justify-end">
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3"
                style={{
                  background: "rgba(61,52,128,0.4)",
                  border: "1px solid rgba(90,75,209,0.4)",
                  borderBottomRightRadius: 4,
                }}
              >
                <p
                  className="mb-1 text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  ඔබ {isListening && "• සවන් දෙමින්"}
                </p>
                <p
                  className="font-sinhala text-[15px] leading-relaxed"
                  style={{ color: "rgba(200,204,245,0.7)" }}
                  lang="si"
                >
                  {interimTranscript}
                  {/* Blinking cursor while listening */}
                  {isListening && (
                    <span
                      className="ml-0.5 inline-block"
                      style={{
                        width: 2,
                        height: "1em",
                        background: "#7c6af7",
                        verticalAlign: "middle",
                        animation: "wave-bar 0.8s step-end infinite",
                      }}
                      aria-hidden
                    />
                  )}
                </p>
              </div>
              <div
                className="ml-2 mt-1 h-6 w-6 shrink-0 rounded-full"
                style={{ background: "#3d4470", opacity: 0.5 }}
                aria-hidden
              />
            </div>
          )}
        </>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
});
