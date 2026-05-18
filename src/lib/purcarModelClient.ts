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

const purcarChatApiUrl =
  import.meta.env.VITE_PURCAR_CHAT_API_URL || "https://ihatebaselines-purcar-chat-api.hf.space/generate";
const purcarHfModelId = import.meta.env.VITE_PURCAR_HF_MODEL_ID || "ihatebaselines/purcar";

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
  if (!purcarChatApiUrl) {
    return createPurcarReply(prompt, options);
  }

  try {
    const response = await fetch(purcarChatApiUrl, {
      body: JSON.stringify({
        input: prompt,
        model: purcarHfModelId,
        temperature: options.temperature ?? 1,
        creativity: options.creativity ?? 50,
        max_new_tokens: 220,
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
    return generated || createPurcarReply(prompt, options);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[PURCAR] model endpoint failed, using local fallback", error);
    }
    return createPurcarReply(prompt, options);
  }
}
