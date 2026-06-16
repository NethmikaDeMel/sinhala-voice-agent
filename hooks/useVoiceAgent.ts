/**
 * hooks/useVoiceAgent.ts
 *
 * The central orchestration hook for the Sinhala Voice Agent.
 *
 * PIPELINE:
 *  1. User taps mic  →  MediaRecorder opens (16 kHz mono PCM)
 *  2. Audio chunks   →  Deepgram WSS (via temp token from /api/deepgram-proxy)
 *  3. Deepgram fires a final transcript  →  POSTed to /api/gemini-chat
 *  4. Gemini streams Sinhala text chunks  →  accumulated into full response
 *  5. Full response  →  POSTed to /api/tts-stream
 *  6. ElevenLabs MPEG stream  →  decoded & played via Web Audio API
 *
 * STATE MACHINE:
 *   idle  →  listening  →  thinking  →  speaking  →  idle
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentState = "idle" | "listening" | "thinking" | "speaking";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface VoiceAgentReturn {
  /** Current FSM state */
  agentState: AgentState;
  /** Live partial transcript while user is speaking */
  interimTranscript: string;
  /** Completed conversation turns */
  history: ConversationTurn[];
  /** Last error message, if any */
  error: string | null;
  /** Toggle recording on/off */
  toggleListening: () => void;
  /** Clear conversation history */
  clearHistory: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Target sample rate for Deepgram whisper-large */
const SAMPLE_RATE = 16_000;

/**
 * Number of PCM samples per buffer sent to Deepgram.
 * 4096 @ 16 kHz ≈ 256 ms of audio per message.
 */
const SCRIPT_BUFFER_SIZE = 4096;

// ── Hook ───────────────────────────────────────────────────────────────────

export function useVoiceAgent(): VoiceAgentReturn {
  // ── State ────────────────────────────────────────────────────────────────

  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Refs (mutable, no re-render needed) ─────────────────────────────────

  /** The live Deepgram WebSocket connection */
  const wsRef = useRef<WebSocket | null>(null);

  /** AudioContext used for mic capture and TTS playback */
  const audioCtxRef = useRef<AudioContext | null>(null);

  /** ScriptProcessorNode that feeds PCM to Deepgram */
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  /** MediaStream from getUserMedia */
  const streamRef = useRef<MediaStream | null>(null);

  /** Whether we are actively recording */
  const isRecordingRef = useRef(false);

  /** Accumulated final transcript for the current utterance */
  const finalTranscriptRef = useRef("");

  /**
   * Conversation history kept in a ref so the async Gemini handler always
   * sees the latest value without stale closure issues.
   */
  const historyRef = useRef<ConversationTurn[]>([]);

  // Keep historyRef in sync with state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // ── Audio context factory ─────────────────────────────────────────────

  /**
   * Lazily creates (or resumes) a shared AudioContext.
   * Must be called inside a user-gesture handler to satisfy browser
   * autoplay policy.
   */
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // ── Stop recording ────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    // Disconnect the ScriptProcessor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop all MediaStream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Signal Deepgram that we're done sending (send CloseStream message)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
    }
  }, []);

  // ── TTS playback ──────────────────────────────────────────────────────

  /**
   * Fetches the TTS audio stream from ElevenLabs (via our proxy) and plays
   * it through the Web Audio API, resolving when playback finishes.
   */
  const playTTS = useCallback(
    async (text: string): Promise<void> => {
      const ctx = getAudioContext();

      const res = await fetch("/api/tts-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "TTS failed" }));
        throw new Error(err.error ?? "TTS stream error");
      }

      if (!res.body) throw new Error("Empty TTS response body");

      // Read the full MPEG stream into an ArrayBuffer, then decode.
      // This approach works in all browsers without MSE complexity.
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Play the decoded audio
      await new Promise<void>((resolve, reject) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);
        // Safety timeout: if onended never fires (browser quirk), resolve anyway
        setTimeout(resolve, (audioBuffer.duration + 2) * 1000);
      });
    },
    [getAudioContext]
  );

  // ── Gemini + TTS pipeline ─────────────────────────────────────────────

  /**
   * Takes the final user transcript, streams Gemini's reply, then plays it
   * through ElevenLabs TTS.
   */
  const runLLMAndTTS = useCallback(
    async (userText: string) => {
      setAgentState("thinking");
      setInterimTranscript("");

      // Snapshot history before we modify state
      const currentHistory = historyRef.current;

      // Append user turn to history
      const userTurn: ConversationTurn = { role: "user", text: userText };
      const updatedHistory = [...currentHistory, userTurn];
      setHistory(updatedHistory);

      try {
        // --- Stream Gemini response ---
        const geminiRes = await fetch("/api/gemini-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: userText,
            // Send last 6 turns as context window (3 user + 3 assistant)
            history: currentHistory.slice(-6).map((t) => ({
              role: t.role === "user" ? "user" : "model",
              text: t.text,
            })),
          }),
        });

        if (!geminiRes.ok) {
          const err = await geminiRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Gemini error ${geminiRes.status}`);
        }

        if (!geminiRes.body) throw new Error("Empty Gemini response");

        // Read streaming text chunks
        const reader = geminiRes.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullReply += decoder.decode(value, { stream: true });
        }

        // Flush any remaining bytes
        fullReply += decoder.decode();

        // Trim and validate
        const trimmedReply = fullReply.trim();
        if (!trimmedReply) throw new Error("Gemini returned empty response");

        // Append assistant turn to history
        const assistantTurn: ConversationTurn = {
          role: "assistant",
          text: trimmedReply,
        };
        setHistory((prev) => [...prev, assistantTurn]);

        // --- Play TTS ---
        setAgentState("speaking");
        await playTTS(trimmedReply);
      } catch (err) {
        console.error("[useVoiceAgent] LLM/TTS error:", err);
        setError(
          err instanceof Error ? err.message : "Unknown error occurred"
        );
      } finally {
        setAgentState("idle");
      }
    },
    [playTTS]
  );

  // ── Start recording ───────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null);
    finalTranscriptRef.current = "";
    setInterimTranscript("");

    // --- 1. Get Deepgram temporary token ---
    let dgToken: string;
    let dgUrl: string;
    try {
      const res = await fetch("/api/deepgram-proxy");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to obtain Deepgram token");
      }
      const data = (await res.json()) as { token: string; url: string };
      dgToken = data.token;
      dgUrl = data.url;
    } catch (err) {
      console.error("[useVoiceAgent] Deepgram proxy error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to connect to Deepgram"
      );
      return;
    }

    // --- 2. Open WebSocket to Deepgram ---
    const wsUrl = `${dgUrl}&token=${encodeURIComponent(dgToken)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    // Handle Deepgram transcript events
    ws.onmessage = (event: MessageEvent) => {
      // Deepgram sends JSON messages
      let msg: DeepgramTranscriptEvent;
      try {
        msg = JSON.parse(event.data as string) as DeepgramTranscriptEvent;
      } catch {
        return; // ignore non-JSON frames
      }

      if (msg.type !== "Results") return;

      const alt = msg.channel?.alternatives?.[0];
      if (!alt) return;

      const text = alt.transcript?.trim() ?? "";
      if (!text) return;

      if (msg.is_final) {
        // Final segment: add to accumulated transcript
        finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + text;
        setInterimTranscript(finalTranscriptRef.current);
      } else {
        // Interim: display final so far + current partial
        setInterimTranscript(
          finalTranscriptRef.current
            ? `${finalTranscriptRef.current} ${text}`
            : text
        );
      }
    };

    ws.onerror = (ev) => {
      console.error("[useVoiceAgent] WebSocket error:", ev);
      setError("WebSocket error — check Deepgram credentials.");
      setAgentState("idle");
    };

    ws.onclose = (ev) => {
      /**
       * When the WS closes (either we triggered it or an error), kick off
       * the Gemini + TTS pipeline if we have a transcript.
       */
      const transcript = finalTranscriptRef.current.trim();
      if (transcript && isRecordingRef.current === false) {
        // User stopped voluntarily → run the pipeline
        runLLMAndTTS(transcript).catch(console.error);
      }
    };

    // --- 3. Request microphone access ---
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      console.error("[useVoiceAgent] getUserMedia error:", err);
      ws.close();
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow access and try again."
          : "Could not access microphone.";
      setError(msg);
      return;
    }

    streamRef.current = stream;

    // --- 4. Set up Audio pipeline: mic → ScriptProcessor → Deepgram ---
    const ctx = getAudioContext();
    const source = ctx.createMediaStreamSource(stream);

    /**
     * ScriptProcessorNode converts the float32 AudioBuffer samples to
     * 16-bit signed integers (linear16) that Deepgram expects.
     *
     * Note: ScriptProcessorNode is technically deprecated in favour of
     * AudioWorklet, but AudioWorklet requires an extra .js file to be
     * served (complex in Next.js without a custom Webpack plugin) and
     * ScriptProcessorNode still works perfectly in all major browsers.
     * It will not be removed until AudioWorklet adoption is near-universal.
     */
    const processor = ctx.createScriptProcessor(SCRIPT_BUFFER_SIZE, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (
        !isRecordingRef.current ||
        ws.readyState !== WebSocket.OPEN
      )
        return;

      const float32 = e.inputBuffer.getChannelData(0);

      // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const clamped = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      }

      ws.send(int16.buffer);
    };

    source.connect(processor);
    // Connect to destination with zero gain to keep the graph alive
    // (ScriptProcessorNode requires a connected output to fire)
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // silent — we don't want mic feedback
    processor.connect(gainNode);
    gainNode.connect(ctx.destination);

    isRecordingRef.current = true;
    setAgentState("listening");
  }, [getAudioContext, runLLMAndTTS]);

  // ── Toggle ────────────────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    if (agentState === "listening") {
      // User taps to stop → trigger pipeline
      stopRecording();
    } else if (agentState === "idle") {
      startRecording().catch((err) => {
        console.error("[useVoiceAgent] startRecording threw:", err);
        setError("Could not start recording.");
      });
    }
    // Ignore taps while "thinking" or "speaking"
  }, [agentState, startRecording, stopRecording]);

  // ── Clear history ─────────────────────────────────────────────────────

  const clearHistory = useCallback(() => {
    setHistory([]);
    setInterimTranscript("");
    setError(null);
    finalTranscriptRef.current = "";
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopRecording();
      if (wsRef.current) wsRef.current.close();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [stopRecording]);

  // ── Return API ────────────────────────────────────────────────────────

  return {
    agentState,
    interimTranscript,
    history,
    error,
    toggleListening,
    clearHistory,
  };
}

// ── Deepgram message type ─────────────────────────────────────────────────

interface DeepgramTranscriptEvent {
  type: string;
  is_final: boolean;
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  };
}
