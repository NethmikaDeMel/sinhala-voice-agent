# සිංහල කටහඬ සහායකයා — Sinhala Voice Agent

A real-time, voice-to-voice AI assistant that speaks and understands natural Sinhala, built with Next.js 15, TypeScript, and Tailwind CSS v4.

---

## Architecture Overview

```
Browser Mic (PCM 16kHz)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 App                       │
│                                                         │
│  /api/deepgram-proxy  →  Deepgram WSS (whisper-large)   │ ◄── STT (Ears)
│         │  transcript                                   │
│         ▼                                               │
│  /api/gemini-chat     →  Gemini 1.5 Flash (stream)      │ ◄── LLM (Brain)
│         │  Sinhala text                                 │
│         ▼                                               │
│  /api/tts-stream      →  ElevenLabs multilingual v2     │ ◄── TTS (Voice)
│                            MPEG audio stream            │
│                                 │                       │
│                                 ▼                       │
│              Web Audio API decode + play                │
└─────────────────────────────────────────────────────────┘
```



## Quick Start Guide If You to Try This Out Yourself

### 1. Clone & install

```bash
git clone <your-repo>
cd sinhala-voice-agent
npm install
```

### 2. Configure environment variables

Copy `.env.local` and fill in your keys:

```bash
cp .env.local .env.local.bak   # optional backup
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your_google_ai_studio_key
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
```

**Where to get keys:**
| Service | URL |
|---------|-----|
| Gemini | https://aistudio.google.com/app/apikey |
| Deepgram | https://console.deepgram.com/ |
| ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| ElevenLabs Voice ID | ElevenLabs Voice Library → any multilingual voice |

> **Recommended voice:** Use a multilingual voice from ElevenLabs Voice Library. For best Sinhala phoneme support, look for voices trained on South Asian or multilingual datasets.

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (best Web Audio API support).

---

## How It Works — Step by Step

### Recording & STT
1. User taps the orb → `useVoiceAgent.toggleListening()` fires
2. Browser calls `GET /api/deepgram-proxy` → receives a **short-lived Deepgram token** (60 s) and the WebSocket URL. The real API key never leaves the server.
3. Browser opens a WebSocket to `wss://api.deepgram.com/v1/listen?model=whisper-large&language=si&...`
4. `ScriptProcessorNode` converts Float32 mic audio to **Int16 PCM** and sends binary frames over the WebSocket
5. Deepgram sends back JSON messages with `is_final: false` (partial) and `is_final: true` (committed) transcripts
6. User taps orb again → `stopRecording()` sends a `CloseStream` message to Deepgram, which flushes the final transcript

### LLM
7. `runLLMAndTTS(transcript)` posts to `POST /api/gemini-chat` with the transcript + last 6 turns of history
8. Server creates a `generateContentStream` call to **Gemini 1.5 Flash** with the Sinhala-only system instruction
9. Text chunks stream back as `text/plain` over a `ReadableStream`
10. Client accumulates all chunks into the full assistant reply

### TTS
11. Full reply is posted to `POST /api/tts-stream`
12. Server calls ElevenLabs `/text-to-speech/{voiceId}/stream` with `eleven_multilingual_v2`
13. The MPEG audio stream is piped directly to the browser as `audio/mpeg`
14. Browser decodes the full `ArrayBuffer` with `AudioContext.decodeAudioData()` and plays it via a `BufferSourceNode`
15. `agentState` returns to `idle` when playback completes

---

## State Machine

```
         ┌──────────────────────────────────┐
         │                                  │
    ┌────▼────┐  tap   ┌───────────┐        │
    │  idle   ├───────►│ listening │        │
    └────▲────┘        └─────┬─────┘        │
         │                   │ tap/silence  │
         │            ┌──────▼──────┐       │
         │            │  thinking   │       │
         │            └──────┬──────┘       │
         │                   │ Gemini done  │
         │            ┌──────▼──────┐       │
         └────────────│  speaking   ├───────┘
                      └─────────────┘
                       (TTS finishes)
```

---

## Technical Notes

### Why ScriptProcessorNode over AudioWorklet?
AudioWorklet is the modern replacement, but it requires serving a separate `.js` worklet file — complex in Next.js without a custom Webpack plugin (you'd need to configure `publicRuntimeConfig` and static file hosting for the worklet). `ScriptProcessorNode` is deprecated *in spec* but **not removed from any browser** and will be retained until AudioWorklet adoption is ~universal. It works perfectly for this use case.

### Why not `MediaRecorder` for audio capture?
`MediaRecorder` can only produce compressed codec output (webm/opus) which Deepgram accepts, but the compression adds latency and the format negates the advantages of streaming PCM. Raw Int16 PCM via `ScriptProcessorNode` gives the lowest possible latency to Deepgram.

### Why buffer the TTS stream instead of streaming playback?
Web Audio API's `BufferSourceNode` requires the full `AudioBuffer` before playback starts. For true streaming playback you'd need `MediaSource Extensions (MSE)` + chunked MP3 frame parsing — significantly more complex. For conversational use (< 60 s replies) the buffering approach is imperceptible in practice.

### Deepgram temporary token flow
Deepgram's `POST /auth/grant` endpoint creates a short-lived credential (we set 60 s). This is the recommended production pattern — it avoids embedding your API key in any client-side code or network requests visible in DevTools.

---

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full support |
| Edge 90+ | ✅ Full support |
| Firefox 90+ | ✅ Works (ScriptProcessorNode deprecated warnings in console — ignore) |
| Safari 15.4+ | ⚠️ Partial — AudioContext autoplay requires user gesture (handled) |
| Mobile Chrome | ✅ Works |
| Mobile Safari | ⚠️ May need user gesture before AudioContext resumes |

---

## Environment Variable Security

All API keys are **server-side only** (no `NEXT_PUBLIC_` prefix). The browser never sees them. Each API route acts as a secure proxy:

- `DEEPGRAM_API_KEY` → used only in `/api/deepgram-proxy` to issue short-lived tokens
- `GEMINI_API_KEY` → used only in `/api/gemini-chat`
- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` → used only in `/api/tts-stream`
