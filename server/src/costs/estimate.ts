/**
 * List prices for rough cost estimates (sample script only; the real bill depends on the plan).
 * Checked 2026-10-31. Flash v2.5 pay-as-you-go API rate; a plan's included quota costs nothing extra.
 */
export const ELEVENLABS_FLASH_USD_PER_1K_CHARS = 0.05;

/** USD per million tokens. Matches what OpenRouter reported for real calls. */
export const LLM_USD_PER_MILLION_TOKENS: Readonly<Record<string, { input: number; output: number }>> = {
  'google/gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
};

/** Pure: estimated voice cost in USD for this many characters. */
export function estimateTtsUsd(characters: number): number {
  return (characters / 1000) * ELEVENLABS_FLASH_USD_PER_1K_CHARS;
}

/** Pure: estimated AI cost in USD, or undefined when the model's price is not known here. */
export function estimateLlmUsd(model: string, promptTokens: number, completionTokens: number): number | undefined {
  const price = LLM_USD_PER_MILLION_TOKENS[model];
  if (!price) return undefined;
  return (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
}
