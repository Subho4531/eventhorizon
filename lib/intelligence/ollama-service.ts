/**
 * lib/intelligence/ollama-service.ts
 *
 * Integration with local Ollama instance for AI-driven market analysis.
 * Model: gpt-oss:120b-cloud
 */

export interface AIScoreResponse {
  score: number;
  confidence: number;
  reasoning: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const MODEL_NAME = "gpt-oss:120b-cloud";

/**
 * Generate an AI probability score for a market.
 */
export async function getAIMarketScore(
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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

    const data = (await response.json()) as { response: string };
    const result = JSON.parse(data.response) as AIScoreResponse;

    return {
      score: result.score,
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error("[OllamaService] AI scoring failed:", error);
    return null;
  }
}
