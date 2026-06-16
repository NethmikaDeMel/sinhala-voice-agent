/**
 * app/api/gemini-chat/route.ts
 *
 * PURPOSE: Receives a Sinhala transcript from the client, sends it to
 * Google Gemini 1.5 Flash via the official @google/genai SDK, and streams
 * text chunks back using the Web Streams API (ReadableStream).
 *
 * The system instruction locks the model to respond only in Sinhala and
 * in a warm, assistant-like tone.
 *
 * SECURITY: GEMINI_API_KEY never reaches the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ── Gemini client (singleton) ──────────────────────────────────────────────

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

// ── System instruction (Sinhala-only assistant) ────────────────────────────

const SYSTEM_INSTRUCTION =
  "ඔබ මගේ කටහඬ සහායකයායි. කරුණාකර ඉතා සුහදශීලීව සිංහලෙන් පමණක් පිළිතුරු දෙන්න. " +
  "ඔබේ පිළිතුරු කෙටි, ස්වාභාවික සහ සංවාදශීලී විය යුතුය. " +
  "කිසිදු ඉංග්‍රීසි වචනයක් හෝ රෝමාකරය භාවිතා නොකරන්න.";
// Translation: "You are my voice assistant. Please respond very warmly in
// Sinhala only. Your answers should be short, natural and conversational.
// Do not use any English words or romanization."

// ── Request schema ─────────────────────────────────────────────────────────

interface ChatRequest {
  transcript: string; // Sinhala text from Deepgram
  history?: Array<{ role: "user" | "model"; text: string }>; // optional context
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // --- Parse request body ---
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { transcript, history = [] } = body;

  if (!transcript || transcript.trim().length === 0) {
    return NextResponse.json(
      { error: "Empty transcript received." },
      { status: 400 }
    );
  }

  // --- Build Gemini client ---
  let ai: GoogleGenAI;
  try {
    ai = getAI();
  } catch (err) {
    console.error("[gemini-chat] Init error:", err);
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  /**
   * Build the conversation history for multi-turn context.
   * Gemini alternates user / model roles.
   */
  const contents = [
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user" as const,
      parts: [{ text: transcript }],
    },
  ];

  // --- Create a ReadableStream to pipe Gemini chunks to the client ---
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const response = await ai.models.generateContentStream({
          model: "models/gemini-1.5-flash",
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
            maxOutputTokens: 512,
          },
          contents,
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            // Stream each chunk as a UTF-8 encoded text event
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        console.error("[gemini-chat] Stream error:", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n[ERROR: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Allow the browser to read the stream as it arrives
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
