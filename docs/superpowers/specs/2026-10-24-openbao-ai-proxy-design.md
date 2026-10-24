# URL + Model Only AI Enrichment (`WiktApi -> Miss -> LLM`)

## 1. Intent & Why

In `nacfson_pipeline`, all AI API credentials (OpenBao) and upstream routing live inside the Kubernetes cluster. `Project_PN` must remain completely agnostic of API keys, OpenBao tokens, and multi-tier LLM fallback chains.

Instead, `Project_PN` uses a strict, minimal enrichment pipeline:
1. **WiktApi First** (`ORIGIN_WIKTAPI_BASE_URL`, default `https://api.wiktapi.dev`): Free, key-less dictionary lookup runs first for every lookup and translation request.
2. **Primary LLM on Miss** (`ENRICH_PRIMARY_BASE_URL` + `ENRICH_PRIMARY_MODEL`): When WiktApi misses or errors, and `ENRICH_PRIMARY_BASE_URL` is configured, `Project_PN` sends the request with only the **URL** and **Model** name (`POST {ENRICH_PRIMARY_BASE_URL}/chat/completions`).
3. **Fail Fast with Stdout Error Logs**: If the LLM endpoint returns a non-200 status code or transport error (or if `ENRICH_PRIMARY_BASE_URL` is not configured when WiktApi misses), the backend logs the error to **stdout** and stops immediately—no secondary LLM fallback (`ENRICH_FALLBACK_*`), no phrase-first routing (`PhrasePreferLLM`), and no silent draft sense creation (`phraseDraftEntry`).

## 2. Goals, Non-Goals, and Anti-Goals

- **Goals**:
  - **Config (`backend/internal/config/config.go`)**:
    - Remove `defaultEnrichPrimaryBaseURL` (`https://generativelanguage.googleapis.com/v1beta/openai`), `EnrichPrimaryAPIKey` (`ENRICH_PRIMARY_API_KEY` / `ENRICH_API_KEY`), and `EnrichFallbackBaseURL`, `EnrichFallbackAPIKey`, `EnrichFallbackModel` (`ENRICH_FALLBACK_*`).
    - Keep `OriginWiktAPIBaseURL` (`ORIGIN_WIKTAPI_BASE_URL`), `EnrichPrimaryBaseURL` (`ENRICH_PRIMARY_BASE_URL` / `ENRICH_BASE_URL`), and `EnrichPrimaryModel` (`ENRICH_PRIMARY_MODEL` / `ENRICH_MODEL`, defaulting to `gemini-3.1-flash-lite` when `EnrichPrimaryBaseURL` is non-empty).
  - **LLM Client (`backend/internal/enrich/openai.go`)**:
    - Change `NewOpenAI(baseURL, model string)` and `OpenAIEnricher` to use only `BaseURL` and `Model` (remove `APIKey` and the `Authorization` header).
    - Return `ErrNotConfigured` when `BaseURL` or `Model` is empty.
    - When `complete()` encounters a transport error or non-200 HTTP status code, log the error details (`url`, `model`, `status_code`, `body`) to **stdout** (`os.Stdout`) and return `ErrUnavailable` immediately.
  - **Enrichment Routing & Lookup (`cmd/api/main.go`, `cmd/retranslate-senses/main.go`, `internal/words/service.go`)**:
    - Wire `WiktAPI` first and `OpenAIEnricher` second via `enrich.NewFallback(primaryEnricher, llm, stdoutLogger)` whenever `cfg.EnrichPrimaryBaseURL != ""`.
    - Delete `PhrasePreferLLM` (`internal/enrich/phrase_route.go` and `phrase_route_test.go`).
    - Delete `phraseDraftEntry` (`internal/words/phrase_draft.go` and `phrase_draft_test.go`) and update `words.Service.Lookup` so enrichment errors log to **stdout** and return the error immediately.
  - **Cluster Boundary & Docs (`deploy/projects/pn/boundary/network-policy.yaml`, `backend/docs/`)**:
    - Allow egress in `network-policy.yaml` to the in-cluster AI service (`vault` namespace port `8080`) and public HTTPS `:443` for WiktApi.
    - Update `cursor-secrets.md`, `oracle-deploy-runbook.md`, and `go-backend-setup.md` to reflect URL + Model only (`ENRICH_PRIMARY_BASE_URL` + `ENRICH_PRIMARY_MODEL`) and remove `ENRICH_PRIMARY_API_KEY` and `ENRICH_FALLBACK_*`.
- **Non-Goals**:
  - Modifying the JSON prompt/response schema between `OpenAIEnricher` and the `/chat/completions` endpoint.
- **Anti-Goals**:
  - Storing or sending any AI API key (`ENRICH_PRIMARY_API_KEY` / `Authorization: Bearer`) from `Project_PN`.
  - Keeping `ENRICH_FALLBACK_*`, `PhrasePreferLLM`, or `phraseDraftEntry`.

## 3. Constraints

- Go 1.26 (`GOTOOLCHAIN=go1.26.0`).
- Error logs on LLM failure must be written to `os.Stdout`.
- Default model when `ENRICH_PRIMARY_BASE_URL` is set and `ENRICH_PRIMARY_MODEL` is omitted: `gemini-3.1-flash-lite`.

## 4. Approaches Considered

### Approach A (Selected): URL + Model Only (`WiktApi -> Miss -> LLM`)
- `Project_PN` holds no AI credentials and only sends `POST {ENRICH_PRIMARY_BASE_URL}/chat/completions` with `model: ENRICH_PRIMARY_MODEL` when WiktApi misses. The Kubernetes cluster (`nacfson_pipeline` + OpenBao) owns credential injection and upstream routing. On error, `Project_PN` logs to stdout and stops.

### Approach B (Rejected): Cluster Proxy Token Assembly Inside `Project_PN`
- Having `Project_PN` assemble `AI_PROXY_HOST` / `AI_PROXY_TOKEN` headers. Rejected because it couples `Project_PN` to cluster-internal OpenBao conventions when a plain cluster URL + model is sufficient.
