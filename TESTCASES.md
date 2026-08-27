# Test Cases — Token / Cost Inspector

Manual QA checklist. Each case lists setup, steps, and expected result.
"Provider" cases should be run once for OpenAI and once for Gemini unless
noted as provider-specific.

## 1. API key handling

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-01 | Missing key blocked | Leave API key blank, upload a valid .txt, click Run | Error box: "Enter an API key for the selected provider first." No network call made. |
| TC-02 | Invalid/garbage key | Enter a random string as key, run with any file | Error box shows the provider's actual auth error (e.g. 401), not a silent failure or crash. |
| TC-03 | Key not persisted | Enter a valid key, run once, refresh the page | Key field is empty again (nothing saved to localStorage/disk). |
| TC-04 | Switch provider clears model | Select OpenAI, pick a model, switch to Gemini | Model dropdown resets to a valid Gemini model (no stale OpenAI model ID left selected). |

## 2. File type handling

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-05 | Plain .txt | Upload a small .txt file with a paragraph | Runs successfully; input tokens > 0, output tokens > 0, response is a summary. |
| TC-06 | .pdf with text layer | Upload a normal text-based PDF (e.g. exported from Word) | Text extracted and summarized; token counts look proportional to document length. |
| TC-07 | Scanned .pdf (image-only) | Upload a PDF that is just scanned images, no selectable text | Clear error: "No selectable text found... try uploading it as an image instead." No crash. |
| TC-08 | .docx | Upload a .docx with a few paragraphs and a heading | Text extracted correctly (headings/paragraphs concatenated), summarized successfully. |
| TC-09 | Legacy .doc | Upload an old-format .doc file | Clear error telling the user to save as .docx; app does not hang or silently fail. |
| TC-10 | Image (.png/.jpg) | Upload a photo or screenshot | Model returns an image summary (not a text-extraction error); input tokens reflect image+prompt tokens. |
| TC-11 | Unsupported extension | Upload a .zip or .exe | Error: "Unsupported file type: .zip..." before any API call is made. |
| TC-12 | Empty file | Upload a 0-byte .txt file | Either a graceful "no content" error, or a run with ~0 input tokens — not a crash. |
| TC-13 | Very large file | Upload a large .txt (e.g. 500K+ words) | Either succeeds (possibly slow) or fails with the provider's own context-length error — surfaced clearly, not a blank screen. |
| TC-14 | Pasted text mode | Switch to "Paste text", type/paste a paragraph, run | Same token/cost readout behavior as file upload; no file required. |
| TC-15 | Non-English text | Upload/paste text in a non-Latin script (e.g. Hindi, Japanese) | Extraction and summarization work; token count reflects that script's tokenizer behavior (often more tokens per character). |

## 3. Token & cost accuracy

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-16 | Token counts match provider | Run the same input via this app and note input/output tokens; separately check the provider's own dashboard/usage page for the same call | Numbers match (or are within rounding) — confirms we're reading `usage`/`usageMetadata` correctly, not estimating. |
| TC-17 | Cost math sanity check | Note input tokens, output tokens, and the model's listed $/1M rates in `src/pricing.js`; hand-calculate cost | App's displayed USD cost matches the manual calculation to the cent/fraction shown. |
| TC-18 | INR conversion | Change the USD→INR rate field to a known value (e.g. 90), rerun/observe | INR figure = USD total × the rate entered, recalculated live. |
| TC-19 | Model switch changes price | Run the same file on a cheap model, then an expensive model, same provider | Token counts may differ slightly (different tokenizers) but cost differs in line with each model's listed rate in the dropdown. |
| TC-20 | Zero-output edge case | Force a case where the model returns an empty/very short response (e.g. trivial input) | Output tokens shown as a small number or 0, not `NaN`; cost still computes (input cost only). |

## 4. Error handling / resilience

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-21 | No internet | Disconnect network, click Run | Fetch fails; error box shows a readable message, not an unhandled exception in console only. |
| TC-22 | Rate limit / quota exceeded | Use a key that's hit its quota (or a free-tier key past its daily limit) | Provider's 429 error message surfaced in the error box. |
| TC-23 | Double-click Run | Click "Run & measure cost" twice quickly | Button shows disabled/loading state on first click; second click does not fire a duplicate request. |
| TC-24 | Switch input mode mid-flow | Upload a file, then switch to "Paste text" before running | Previously selected file is not silently used; app runs on whichever mode is currently active. |

## 5. UI / responsiveness

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-25 | Mobile width | Open the app at a ~375px viewport width | Controls and readout stack vertically; no horizontal scroll or overlapping text. |
| TC-26 | Long response text | Run a file that produces a long summary | Response box scrolls internally rather than pushing the page layout out of shape. |
| TC-27 | Keyboard navigation | Tab through provider toggle, model dropdown, key field, run button | Visible focus outline on every interactive element; Run button reachable and triggerable via Enter/Space. |
| TC-28 | Remove file before running | Upload a file, click "remove", then click Run without re-uploading | Error: "Choose a file to upload..." — does not try to reuse the removed file. |

## 6. Cross-provider parity

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-29 | Same file, both providers | Run identical input through OpenAI and then Gemini | Both complete successfully; token counts differ (different tokenizers) but both are plausible and both costs compute correctly for their own pricing table. |
| TC-30 | Vision on both providers | Run the same image through an OpenAI vision model and a Gemini model | Both return a sensible image summary and non-zero token usage; no provider-specific crash. |

## 7. LangSmith tracing

| ID | Case | Steps | Expected |
|----|------|-------|----------|
| TC-31 | Tracing on, key configured | With `LANGSMITH_API_KEY` set in the deployment, run any input with the checkbox on | "Logged to LangSmith ✓" appears; the run shows up in the LangSmith project within a few seconds, with correct tokens/cost/model in its metadata. |
| TC-32 | Tracing on, key missing | Leave `LANGSMITH_API_KEY` unset, run any input with the checkbox on | App still completes the run normally; a quiet "Tracing skipped: LANGSMITH_API_KEY not set..." note appears, no error thrown to the user. |
| TC-33 | Tracing off | Uncheck "Log runs to LangSmith", run any input | No call to `/api/log-run` is made (verify in Network tab); no trace note shown. |
| TC-34 | Failed run still logged | Trigger an API error (e.g. bad key) with tracing on | A run with `error` set is still sent to LangSmith so failures are visible to the team, not just successes. |
| TC-35 | No sensitive data leaked | Inspect the payload sent to `/api/log-run` in the Network tab | Contains only provider/model/tokens/cost/latency and truncated (≤500 char) prompt/response previews — never the OpenAI/Gemini API key. |

