# <img src="documentation/images/bloomreach-logo.svg" width="32" height="32" alt="Bloomreach logo" /> Bloomreach Conversational Agent API

Documentation and reference test clients for the Bloomreach Conversational Agent API (also referred to as CoCoAaS — Conversational Commerce as a Service). This repo is meant to help frontend integrators understand the API contract and validate their integration against a real backend.

Refer to the [Bloomreach documentation](https://documentation.bloomreach.com/clarity/reference/get-started) for an interactive API reference and getting started guide.

## Contents

| Path | What it is |
|---|---|
| [`documentation/`](./documentation/README.md) | **Frontend Integration Guide.** The primary reference document: initialization flow, the `send-event` streaming channel, event catalog (user/assistant messages, carousels, quick replies, notifications, errors), PDP/PLP/search endpoints, and status codes. Start here. |
| [`openapi-spec.json`](./openapi-spec.json) | OpenAPI spec (`v1.0.0`) for the same API surface: chat (`general-settings`, `send-event`) and Conversational Agent Search (catalog items, parent products, PLP, suggestions). Use it to generate typed clients or import into API tooling (Postman, Swagger UI, etc.). |
| [`chat-client-js/`](./chat-client-js) | Zero-dependency, single-file (`index.html`) vanilla JS chat client. No build step — open it in a browser or serve it statically. Fastest way to manually poke at a backend and watch raw events. |
| [`chat-client-react/`](./chat-client-react) | TypeScript + React + Vite implementation of the same client. Closer to how a real frontend integration would be structured; also exposes typed helpers for the Conversational Agent Search endpoints (PDP/PLP/suggestions). |

Both clients implement the same integration contract described in [`documentation/`](./documentation/README.md): onboarding (`apiUrl`/`agentId`/`apiToken`/`currency`/`endCustomerId`), cached `general-settings` lookup, `SYNC_EVENT_LOG` history restoration, the streaming `send-event` channel, quick replies, product carousels, notifications, and UI-only HTTP error simulation (400/429/500) for testing error handling without a backend. Each has its own README with run instructions and a doc-validation checklist.

## Which client should I use?

- Want to validate the API contract quickly with no setup? Use **`chat-client-js`** — open `index.html` or serve it with `python3 -m http.server`.
- Want a starting point closer to a production frontend (TypeScript, component structure, env-based config)? Use **`chat-client-react`** — `npm install && npm run dev`.

## Suggested workflow

1. Read [`documentation/`](./documentation/README.md) for the event model and lifecycle.
2. Run one of the chat clients against your `apiUrl`/`agentId`/`apiToken` and step through its doc-validation checklist.
3. Refer to the [API reference](https://documentation.bloomreach.com/clarity/reference/get-assistant-settings) and `openapi-spec.json` for exact request/response shapes when building your own integration.
