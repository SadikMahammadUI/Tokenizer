// Calls our own /api/log-run serverless function (never LangSmith directly —
// see api/log-run.js for why). This never sends the user's OpenAI/Gemini API
// key, only usage metadata + short previews of prompt/response.

const PREVIEW_LIMIT = 500;

function truncate(text, limit = PREVIEW_LIMIT) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export async function logRunToLangSmith({
  provider,
  model,
  mode,
  inputTokens,
  outputTokens,
  totalTokens,
  costUSD,
  costINR,
  latencyMs,
  prompt,
  outputText,
  error
}) {
  try {
    const res = await fetch('/api/log-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        mode,
        inputTokens,
        outputTokens,
        totalTokens,
        costUSD,
        costINR,
        latencyMs,
        promptPreview: truncate(prompt),
        outputPreview: truncate(outputText),
        error: error || null
      })
    });
    return await res.json();
  } catch (err) {
    // Tracing is a nice-to-have, not something that should ever break the
    // main flow — swallow and just note it in the console.
    console.warn('LangSmith logging skipped:', err.message);
    return { logged: false, reason: err.message };
  }
}
