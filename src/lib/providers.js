// Thin client-side wrappers around the two APIs. Keys are only ever held in
// browser memory/state for this session — never sent anywhere except the
// provider's own endpoint, and never persisted to disk or localStorage.

async function parseErr(res) {
  let body = '';
  try {
    body = await res.text();
  } catch (_) {}
  return `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`;
}

export async function callOpenAI({ apiKey, model, prompt, image }) {
  const content = [{ type: 'text', text: prompt }];
  if (image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` }
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }]
    })
  });

  if (!res.ok) throw new Error(`OpenAI API error: ${await parseErr(res)}`);
  const data = await res.json();

  return {
    outputText: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0
  };
}

export async function callGemini({ apiKey, model, prompt, image }) {
  const parts = [{ text: prompt }];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${await parseErr(res)}`);
  const data = await res.json();

  const outputText =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';

  return {
    outputText,
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0
  };
}

export async function runQuery(provider, args) {
  return provider === 'openai' ? callOpenAI(args) : callGemini(args);
}
