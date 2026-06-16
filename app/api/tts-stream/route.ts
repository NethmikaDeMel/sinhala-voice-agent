/**
 * app/api/tts-stream/route.ts
 *
 * PURPOSE: Receives a Sinhala text string from the client and proxies it
 * to the ElevenLabs streaming TTS endpoint, piping the raw MPEG audio
 * bytes back to the browser as a ReadableStream.
 *
 * The browser decodes and plays the audio using the Web Audio API.
 *
 * SECURITY: ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID never reach
 * the browser.
 *
 * MODEL: eleven_multilingual_v2 — best quality for non-English languages
 * including Sinhala phonemes.
 */

import { NextRequest, NextResponse } from "next/server";

// ── ElevenLabs API config ──────────────────────────────────────────────────

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const TTS_MODEL = "eleven_multilingual_v2";

// ── Request schema ─────────────────────────────────────────────────────────

interface TTSRequest {
  text: string; // Sinhala text to synthesize
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    console.error("[tts-stream] Missing ElevenLabs credentials");
    return NextResponse.json(
      { error: "Server misconfiguration: missing ElevenLabs credentials." },
      { status: 500 }
    );
  }

  // --- Parse request ---
  let body: TTSRequest;
  try {
    body = (await req.json()) as TTSRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text } = body;
  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "Empty text received." }, { status: 400 });
  }

  // --- Call ElevenLabs streaming endpoint ---
  const elUrl = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream`;

  let elResponse: Response;
  try {
    elResponse = await fetch(elUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL,
        voice_settings: {
          // Stability: lower = more expressive; higher = more consistent
          stability: 0.45,
          // Similarity boost: how closely the voice matches the target
          similarity_boost: 0.82,
          // Style exaggeration: slight warmth for a conversational tone
          style: 0.25,
          use_speaker_boost: true,
        },
        // Optimise for streaming latency (1 = fastest; lower quality tradeoff)
        optimize_streaming_latency: 1,
        // Output format: mp3_44100_128 works in all browsers without extra codec
        output_format: "mp3_44100_128",
      }),
    });
  } catch (err) {
    console.error("[tts-stream] Network error calling ElevenLabs:", err);
    return NextResponse.json(
      { error: "Network error contacting ElevenLabs." },
      { status: 502 }
    );
  }

  if (!elResponse.ok) {
    const errText = await elResponse.text();
    console.error(
      "[tts-stream] ElevenLabs error:",
      elResponse.status,
      errText
    );
    return NextResponse.json(
      { error: `ElevenLabs error ${elResponse.status}: ${errText}` },
      { status: 502 }
    );
  }

  // --- Pipe ElevenLabs stream directly to client ---
  // elResponse.body is a ReadableStream<Uint8Array>; we forward it as-is.
  if (!elResponse.body) {
    return NextResponse.json(
      { error: "ElevenLabs returned empty body." },
      { status: 502 }
    );
  }

  return new Response(elResponse.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
      // Allow the audio element / Web Audio to process as chunks arrive
      "Transfer-Encoding": "chunked",
    },
  });
}
