// Vercel serverless function (Node runtime). Deployed automatically at
// /api/log-run because it lives in the /api directory — no extra config
// needed on Vercel.
//
// Why this exists as a server function instead of calling LangSmith directly
// from the browser: LangSmith's API key is a shared TEAM credential (unlike
// the OpenAI/Gemini keys, which are each person's own). Shipping a shared
// key to every browser tab would let anyone open dev tools and lift it, and
// use it to view or spam your team's trace project. Keeping it as a
// server-only environment variable avoids that.
//
// Required environment variable (set in Vercel/Netlify project settings,
// NOT in a committed file): LANGSMITH_API_KEY
// Optional: LANGSMITH_PROJECT (defaults to "token-cost-inspector")

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.LANGSMITH_API_KEY;
  if (!apiKey) {
    // Not configured — tell the frontend so it can show a quiet hint
    // instead of a scary error. This is not a failure of the tool itself.
    res.status(200).json({ logged: false, reason: 'LANGSMITH_API_KEY not set on the server.' });
    return;
  }

  const project = process.env.LANGSMITH_PROJECT || 'token-cost-inspector';

  const {
    provider,
    model,
    mode, // 'file-text' | 'file-image' | 'paste-text'
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    costUSD = 0,
    costINR = 0,
    latencyMs = 0,
    promptPreview = '',
    outputPreview = '',
    error = null
  } = req.body || {};

  const runId = crypto.randomUUID();
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - Math.max(0, latencyMs));

  const payload = {
    id: runId,
    name: `${provider}:${model}`,
    run_type: 'llm',
    session_name: project,
    inputs: { prompt_preview: promptPreview, mode },
    outputs: error ? undefined : { response_preview: outputPreview },
    error: error || undefined,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    extra: {
      metadata: {
        provider,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        cost_usd: costUSD,
        cost_inr: costINR,
        latency_ms: latencyMs
      }
    }
  };

  try {
    const lsRes = await fetch('https://api.smith.langchain.com/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!lsRes.ok) {
      const text = await lsRes.text();
      res.status(200).json({ logged: false, reason: `LangSmith responded ${lsRes.status}: ${text.slice(0, 300)}` });
      return;
    }

    res.status(200).json({ logged: true, runId, project });
  } catch (err) {
    res.status(200).json({ logged: false, reason: err.message });
  }
}
