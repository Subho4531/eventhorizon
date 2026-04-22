/**
 * lib/intelligence/ollama-service.ts
 *
 * Universal AI service supporting both local Ollama and cloud-based OpenRouter.
 */

export interface AIScoreResponse {
  score: number;
  confidence: number;
  reasoning: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_NAME = process.env.AI_MODEL || "kimi-k2.6:cloud"; 

/**
 * Generate an AI probability score for a market.
 */
export async function getAIMarketScore(
  title: string,
  description: string
): Promise<AIScoreResponse | null> {
  // If OpenRouter API key is provided, use OpenRouter
  if (OPENROUTER_API_KEY) {
    return getOpenRouterScore(title, description);
  }

  // Otherwise, fallback to local Ollama
  return getOllamaScore(title, description);
}

async function getOpenRouterScore(
  title: string,
  description: string
): Promise<AIScoreResponse | null> {
  try {
    const prompt = `
      Analyze the following prediction market and provide a probability estimate (0-100) for it resolving to "YES".
      
      Market Title: ${title}
      Market Description: ${description}
      
      Return ONLY a JSON object with the following structure:
      {
        "score": number (0-100),
        "confidence": number (0.0-1.0),
        "reasoning": "brief string"
      }
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gravityflow.io",
        "X-Title": "GravityFlow",
      },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it:free",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content) as AIScoreResponse;

    return {
      score: result.score,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("[AIService] OpenRouter scoring failed:", error);
    return null;
  }
}

async function getOllamaScore(
  title: string,
  description: string
): Promise<AIScoreResponse | null> {
  try {
    const prompt = `
      Analyze the following prediction market and provide a probability estimate (0-100) for it resolving to "YES".
      
      Market Title: ${title}
      Market Description: ${description}
      
      Return ONLY a JSON object with the following structure:
      {
        "score": number (0-100),
        "confidence": number (0.0-1.0),
        "reasoning": "brief string"
      }
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.response) as AIScoreResponse;

    return {
      score: result.score,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("[AIService] Ollama scoring failed:", error);
    return null;
  }
}
