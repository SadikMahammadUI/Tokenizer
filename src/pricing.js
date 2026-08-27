// ---------------------------------------------------------------------------
// Pricing table — USD per 1,000,000 tokens (input / output).
// LAST CHECKED: 26 Aug 2026. Providers change prices often — before trusting
// this for a real budget, cross-check:
//   OpenAI:  https://openai.com/api/pricing
//   Gemini:  https://ai.google.dev/gemini-api/docs/pricing
// Just edit the numbers below when prices move; nothing else needs to change.
// ---------------------------------------------------------------------------

export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    apiKeyHint: 'sk-...  (from platform.openai.com/api-keys)',
    models: {
      'gpt-4o-mini': { label: 'GPT-4o mini', in: 0.15, out: 0.60, vision: true },
      'gpt-4o': { label: 'GPT-4o', in: 2.50, out: 10.00, vision: true },
      'gpt-4.1-nano': { label: 'GPT-4.1 nano', in: 0.10, out: 0.40, vision: true },
      'gpt-4.1-mini': { label: 'GPT-4.1 mini', in: 0.40, out: 1.60, vision: true },
      'gpt-4.1': { label: 'GPT-4.1', in: 2.00, out: 8.00, vision: true },
      'gpt-5.6-luna': { label: 'GPT-5.6 Luna', in: 0.20, out: 1.20, vision: true },
      'gpt-5.6-terra': { label: 'GPT-5.6 Terra', in: 2.00, out: 12.00, vision: true },
      'gpt-5.6-sol': { label: 'GPT-5.6 Sol', in: 4.00, out: 20.00, vision: true }
    }
  },
  gemini: {
    label: 'Google Gemini',
    apiKeyHint: 'AIza...  (free key from aistudio.google.com/apikey)',
    models: {
      'gemini-3.5-flash-lite': { label: 'Gemini 3.5 Flash-Lite (Fast & Low Cost)', in: 0.30, out: 2.50, vision: true },
      'gemini-2.5-flash-lite': { label: 'Gemini 2.5 Flash-Lite', in: 0.10, out: 0.40, vision: true },
      'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', in: 0.30, out: 2.50, vision: true },
      'gemini-3.7-flash': { label: 'Gemini 3.7 Flash', in: 0.75, out: 3.75, vision: true },
      'gemini-3.1-pro': { label: 'Gemini 3.1 Pro (\u2264200k ctx)', in: 2.00, out: 12.00, vision: true }
    }
  }
};

// Defaults the app boots with.
export const DEFAULT_PROVIDER = 'gemini';
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Fallback USD -> INR rate, used only until the user overrides it in the UI.
// Exchange rates move daily; always let the on-screen field win over this.
export const DEFAULT_USD_TO_INR = 87.5;

export function estimateCost(inputTokens, outputTokens, modelPricing) {
  const inputCostUSD = (inputTokens / 1_000_000) * modelPricing.in;
  const outputCostUSD = (outputTokens / 1_000_000) * modelPricing.out;
  return {
    inputCostUSD,
    outputCostUSD,
    totalCostUSD: inputCostUSD + outputCostUSD
  };
}
