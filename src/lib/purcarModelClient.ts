import { createPurcarReply } from "./purcarBrain";

type GenerateOptions = {
  creativity?: number;
  temperature?: number;
};

type GenerateResponse = {
  text?: string;
  reply?: string;
  generated_text?: string;
  output?: string;
};

const primaryPurcarChatApiUrl =
  import.meta.env.VITE_PURCAR_CHAT_API_URL ||
  "https://ihatebaselines-purcar-chat-api.hf.space/generate";
const legacyPurcarChatApiUrl =
  import.meta.env.VITE_PURCAR_LEGACY_CHAT_API_URL || "";
const purcarHfModelId =
  import.meta.env.VITE_PURCAR_HF_MODEL_ID ||
  "ihatebaselines/purcar-thanatos-0.1";

function extractAssistantText(text: string): string {
  let cleaned = text.trim();
  const assistantMatches = [...cleaned.matchAll(/assistant\s*:/gi)];
  const assistantMatch = assistantMatches[assistantMatches.length - 1];

  if (assistantMatch?.index !== undefined) {
    cleaned = cleaned.slice(assistantMatch.index + assistantMatch[0].length).trim();
  }

  const nextUserMatch = cleaned.search(/\n\s*user\s*:/i);
  if (nextUserMatch >= 0) {
    cleaned = cleaned.slice(0, nextUserMatch).trim();
  }

  return cleaned;
}

function normalizeGeneratedText(payload: unknown): string | null {
  if (typeof payload === "string") {
    return extractAssistantText(payload) || null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const normalized = normalizeGeneratedText(item);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (payload && typeof payload === "object") {
    const data = payload as GenerateResponse;
    const text =
      data.reply?.trim() ||
      data.text?.trim() ||
      data.generated_text?.trim() ||
      data.output?.trim() ||
      null;

    return text ? extractAssistantText(text) || null : null;
  }

  return null;
}

export async function generatePurcarReply(prompt: string, options: GenerateOptions = {}) {
  const endpoints = [...new Set([primaryPurcarChatApiUrl, legacyPurcarChatApiUrl].filter(Boolean))];
  if (!endpoints.length) {
    return createPurcarReply(prompt, options);
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          input: prompt,
          model: purcarHfModelId,
          temperature: options.temperature ?? 1,
          creativity: options.creativity ?? 50,
          max_new_tokens: 48,
          repetition_penalty: 1.15,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`PURCAR model endpoint returned ${response.status}`);
      }

      const generated = normalizeGeneratedText(await response.json());
      if (generated) {
        return generated;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[PURCAR] endpoint failed: ${endpoint}`, error);
      }
    }
  }

  return createPurcarReply(prompt, options);
}
