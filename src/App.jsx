import React, { useState, useCallback } from 'react';
import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL, estimateCost } from './pricing.js';
import { parseUploadedFile } from './lib/parseFile.js';
import { runQuery } from './lib/providers.js';
import { logRunToLangSmith } from './lib/langsmith.js';

const DEFAULT_PROMPT_TEXT = 'Summarize the following document in a short paragraph:\n\n';
const DEFAULT_PROMPT_IMAGE = 'Summarize what this image shows in a short paragraph.';

export default function App() {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [mode, setMode] = useState('file'); // 'file' | 'text'
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [usdToInr, setUsdToInr] = useState(87.5);
  const [tracingEnabled, setTracingEnabled] = useState(true);
  const [traceNote, setTraceNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const modelsForProvider = PROVIDERS[provider].models;
  const selectedPricing = modelsForProvider[model] || Object.values(modelsForProvider)[0];

  function handleProviderChange(next) {
    setProvider(next);
    setModel(Object.keys(PROVIDERS[next].models)[0]);
  }

  const onFilePicked = useCallback((f) => {
    setFile(f);
    setResult(null);
    setError('');
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) onFilePicked(e.dataTransfer.files[0]);
  }

  async function handleRun() {
    setError('');
    setResult(null);
    setTraceNote('');

    if (!apiKey.trim()) {
      setError('Enter an API key for the selected provider first.');
      return;
    }
    if (mode === 'file' && !file) {
      setError('Choose a file to upload, or switch to "Paste text".');
      return;
    }
    if (mode === 'text' && !pastedText.trim()) {
      setError('Paste some text first, or switch to "Upload file".');
      return;
    }

    setLoading(true);
    const startedAt = performance.now();
    let inputMode = mode === 'text' ? 'paste-text' : 'file-text';

    try {
      let prompt;
      let image = null;

      if (mode === 'text') {
        prompt = DEFAULT_PROMPT_TEXT + pastedText;
      } else {
        const parsed = await parseUploadedFile(file);
        if (parsed.kind === 'image') {
          prompt = DEFAULT_PROMPT_IMAGE;
          image = { mimeType: parsed.mimeType, base64: parsed.base64 };
          inputMode = 'file-image';
        } else {
          prompt = DEFAULT_PROMPT_TEXT + parsed.text;
        }
      }

      const { outputText, inputTokens, outputTokens } = await runQuery(provider, {
        apiKey: apiKey.trim(),
        model,
        prompt,
        image
      });

      const cost = estimateCost(inputTokens, outputTokens, selectedPricing);
      const latencyMs = Math.round(performance.now() - startedAt);

      setResult({
        outputText,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        ...cost,
        modelLabel: selectedPricing.label,
        wasImage: Boolean(image)
      });

      if (tracingEnabled) {
        logRunToLangSmith({
          provider,
          model,
          mode: inputMode,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costUSD: cost.totalCostUSD,
          costINR: cost.totalCostUSD * usdToInr,
          latencyMs,
          prompt,
          outputText
        }).then((res) => {
          if (res?.logged) setTraceNote('Logged to LangSmith ✓');
          else if (res?.reason) setTraceNote(`Tracing skipped: ${res.reason}`);
        });
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startedAt);
      setError(err.message || 'Something went wrong.');
      if (tracingEnabled) {
        logRunToLangSmith({
          provider,
          model,
          mode: inputMode,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUSD: 0,
          costINR: 0,
          latencyMs,
          prompt: '',
          outputText: '',
          error: err.message
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const inrTotal = result ? result.totalCostUSD * usdToInr : 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">🧮 AI Tokenizer &amp; Cost Estimator</h1>
        <p className="app__subtitle">
          Estimate input/output tokens, calculate costs in USD &amp; INR, and summarize
          multimodal inputs using your own OpenAI or Gemini key.
        </p>
      </header>

      <div className="grid">
        {/* ---------------- Configuration ---------------- */}
        <div>
          <div className="panel">
            <h2 className="panel__title">🔑 Configuration</h2>

            <div className="field">
              <label>Provider</label>
              <div className="toggle-row">
                {Object.entries(PROVIDERS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={provider === key}
                    onClick={() => handleProviderChange(key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>{provider === 'openai' ? 'OpenAI API Key' : 'Google AI Studio API Key'}</label>
              <input
                type="password"
                placeholder={PROVIDERS[provider].apiKeyHint}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="field-hint">
                Stays in this browser tab only — never saved or sent anywhere but{' '}
                {provider === 'openai' ? 'api.openai.com' : 'generativelanguage.googleapis.com'}.{' '}
                {provider === 'gemini' && (
                  <>
                    Get a free key from{' '}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                      Google AI Studio
                    </a>
                    .
                  </>
                )}
              </p>
            </div>

            <div className="field">
              <label>{provider === 'openai' ? 'OpenAI Model' : 'Gemini Model'}</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {Object.entries(modelsForProvider).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="pricing-box">
                <span className="pricing-box__title">Pricing reference (per 1M tokens)</span>
                <code>
                  {selectedPricing.label}: ${selectedPricing.in.toFixed(2)} in / $
                  {selectedPricing.out.toFixed(2)} out
                </code>
                <br />
                <span>FX rate: $1.00 = ₹{usdToInr.toFixed(2)}</span>
              </div>
            </div>

            <div className="rate-row">
              <span>USD → INR rate:</span>
              <input
                type="number"
                step="0.1"
                value={usdToInr}
                onChange={(e) => setUsdToInr(Number(e.target.value) || 0)}
              />
              <span>(edit if it's stale)</span>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel__title">📊 Visibility</h2>
            <label className="checkbox-row" htmlFor="tracing-toggle">
              <input
                id="tracing-toggle"
                type="checkbox"
                checked={tracingEnabled}
                onChange={(e) => setTracingEnabled(e.target.checked)}
              />
              <div>
                <strong>Log runs to LangSmith</strong>
                <span>
                  Sends model, tokens, cost, and short prompt/response previews (never your API
                  key) to your team's LangSmith project for shared visibility. Requires{' '}
                  <code>LANGSMITH_API_KEY</code> set on the deployment — see README.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* ---------------- Input + Readout ---------------- */}
        <div>
          <div className="panel">
            <h2 className="panel__title">📥 Input Content</h2>

            <div className="field">
              <div className="toggle-row">
                <button type="button" aria-pressed={mode === 'file'} onClick={() => setMode('file')}>
                  Upload file
                </button>
                <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
                  Type / paste text
                </button>
              </div>
            </div>

            {mode === 'file' ? (
              <div className="field">
                <label
                  className={`dropzone${dragActive ? ' is-active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                >
                  <strong>Choose a file, or drop it here</strong>
                  PDF, DOCX, TXT, PNG, JPG, WEBP
                  <input
                    type="file"
                    hidden
                    accept=".txt,.md,.csv,.pdf,.docx,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])}
                  />
                </label>
                {file && (
                  <div className="file-chip">
                    <span>
                      {file.name} · {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <button type="button" onClick={() => setFile(null)}>
                      remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="field">
                <label>Or type / paste text</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste your text or prompt here..."
                />
              </div>
            )}

            <button className="run-btn" onClick={handleRun} disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Running…' : 'Calculate Tokens & Run'}
            </button>

            {error && <div className="error-box">{error}</div>}
            {traceNote && (
              <p className={`trace-note${traceNote.includes('✓') ? ' trace-note--ok' : ''}`}>
                {traceNote}
              </p>
            )}
          </div>

          <div className="readout" style={{ marginTop: 22 }}>
            {!result ? (
              <div className="readout__empty">
                <strong>No reading yet</strong>
                Run a file or a block of text to see input/output tokens and cost here.
              </div>
            ) : (
              <>
                <div className="readout__strip">
                  <div className="readout__cell">
                    <div className="readout__label">Input tokens</div>
                    <div className="readout__value readout__value--indigo">
                      {result.inputTokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="readout__cell">
                    <div className="readout__label">Output tokens</div>
                    <div className="readout__value readout__value--indigo">
                      {result.outputTokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="readout__cell">
                    <div className="readout__label">Total tokens</div>
                    <div className="readout__value">{result.totalTokens.toLocaleString()}</div>
                  </div>
                </div>

                <div className="readout__cost-row">
                  <div className="readout__cell">
                    <div className="readout__label">Cost (USD)</div>
                    <div className="readout__value readout__value--amber">
                      ${result.totalCostUSD.toFixed(6)}
                    </div>
                  </div>
                  <div className="readout__cell">
                    <div className="readout__label">Cost (INR)</div>
                    <div className="readout__value readout__value--amber">
                      ₹{inrTotal.toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="readout__meta">
                  <span>{result.modelLabel}</span>
                  <span>
                    in ${result.inputCostUSD.toFixed(6)} · out ${result.outputCostUSD.toFixed(6)}
                  </span>
                </div>

                <div className="response-box">
                  <h3>{result.wasImage ? 'Image summary' : 'Model response'}</h3>
                  <pre>{result.outputText}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="footnote">
        Prices are editable in <code>src/pricing.js</code> — verify against each provider's live
        pricing page before relying on this for real budgeting.
      </p>
    </div>
  );
}
