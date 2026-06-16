import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Required for ElevenLabs streaming — allows large response bodies
  experimental: {
    // serverActions are stable in Next.js 15, but we use API routes for streaming
  },

  // Ensure server-side env vars are never leaked to the client bundle
  // All GEMINI_, DEEPGRAM_, ELEVENLABS_ vars are server-only (no NEXT_PUBLIC_ prefix)
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;
