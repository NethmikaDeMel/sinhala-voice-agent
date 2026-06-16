/**
 * app/api/deepgram-proxy/route.ts
 *
 * PURPOSE: Secure server-side proxy that returns a short-lived Deepgram
 * WebSocket URL + auth token to the browser.  The browser then connects
 * directly to Deepgram's WSS endpoint using that token — keeping the real
 * API key entirely server-side.
 *
 * FLOW:
 *  Browser → GET /api/deepgram-proxy → { url, token }
 *  Browser opens wss://api.deepgram.com/v1/listen?...  (using token)
 *  Browser streams microphone PCM → Deepgram → JSON transcripts back
 */

import { NextResponse } from "next/server";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Deepgram streaming endpoint with query params baked in:
 *  - model=whisper-large  : best accuracy for low-resource languages
 *  - language=si          : Sinhala (ISO 639-1)
 *  - punctuate=true       : add punctuation to transcripts
 *  - interim_results=true : stream partial transcripts in real time
 *  - endpointing=300      : treat 300 ms silence as end-of-utterance
 *  - encoding=linear16    : raw 16-bit PCM from MediaRecorder
 *  - sample_rate=16000    : 16 kHz — optimal for speech models
 *  - channels=1           : mono microphone
 */
const DEEPGRAM_WSS_BASE =
  "wss://api.deepgram.com/v1/listen?" +
  new URLSearchParams({
    model: "whisper-large",
    language: "si",
    punctuate: "true",
    interim_results: "true",
    endpointing: "300",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  }).toString();

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error("[deepgram-proxy] DEEPGRAM_API_KEY is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: missing Deepgram API key." },
      { status: 500 }
    );
  }

  /**
   * Deepgram's /auth/grant endpoint issues a short-lived (≤ 30 s) token
   * that the browser can use to open the WSS connection.  This way the
   * real API key never leaves the server.
   */
  try {
    const grantRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      // time_to_live_seconds: 60 gives the browser enough time to open the
      // WebSocket before the token expires.
      body: JSON.stringify({ time_to_live_seconds: 60 }),
    });

    if (!grantRes.ok) {
      const text = await grantRes.text();
      console.error("[deepgram-proxy] Grant failed:", grantRes.status, text);
      return NextResponse.json(
        { error: "Failed to obtain Deepgram temporary token." },
        { status: 502 }
      );
    }

    const { key } = (await grantRes.json()) as { key: string };

    // Return the token + the fully-constructed WSS URL to the client
    return NextResponse.json({
      token: key,
      url: DEEPGRAM_WSS_BASE,
    });
  } catch (err) {
    console.error("[deepgram-proxy] Network error:", err);
    return NextResponse.json(
      { error: "Network error contacting Deepgram." },
      { status: 502 }
    );
  }
}
