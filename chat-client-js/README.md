# Conversational Agent — Test Client

A self-contained, single-file chat client used to validate the Clarity / CoCoAaS public API documentation (`../documentation/`, `../openapi-spec.json`).

No frameworks, no build step, no dependencies. Just a browser.

## Run

Pick one:

**Open the file directly**
```
open index.html
```
The browser will load it from `file://...`. Origin will be `null`.

**Serve over HTTP (recommended)**
```
python3 -m http.server 8000
```
Then visit <http://localhost:8000>. Origin will be `http://localhost:8000`. Some browsers handle `fetch` better from a real origin than from `file://`.

## What it does

1. On first load, prompts for four onboarding values:
   - `apiUrl`, `agentId`, `apiToken` — provided by Bloomreach. The token is sent as `Authorization: Bearer <apiToken>` on every API request.
   - `currency` — chosen by the FE/customer integration; must be a valid ISO 4217 code (used for price formatting and sent to the backend in `FE.SET_CONTEXT`)
   - Optionally an `endCustomerId`. If blank, the client generates a UUID and treats it as the user's cookie equivalent.

2. Persists the onboarding to `localStorage` so reloads skip the form.

3. Fetches authenticated `GET .../general-settings` to apply the agent's name, logo, and input placeholder. Persona branding (`assistantName`, `assistantLogo`, and `description`) should be configured in the CoCoAaS backend persona configuration; the client only uses local defaults when those fields are omitted. The response is cached in `localStorage` for 6 hours, keyed by `agentId`; reloads within the TTL reuse the cache and skip the network call, and a matching cached response can still be used if a later refresh fails so branding does not disappear entirely.

4. Sends `SYNC_EVENT_LOG` to hydrate any existing conversation tied to the persisted `chatId`. It asks for a deliberately small page (`limit: 20`, against a server default of 500) so that paging is exercised on an ordinary chat rather than only on a very long one; a production client can omit `limit`. The response opens with `SYNC_EVENT_LOG.META`, and the client reads `hasMore` / `nextCursor` from it to show the **Load earlier messages** button. Older pages come from a plain REST call, `GET .../history?after=<cursor>`, with `SYNC_EVENT_LOG.META` supplying the first cursor.

5. Shows default starter questions below the input box and Send button on an empty chat. Once the user types at least two characters, the client fetches search-triggered Clarity Search suggestions and replaces the defaults with returned conversation-starter questions. Tapping any starter sends it as `ADD_MESSAGE.USER.TEXT`.

6. Lets you chat. The client handles all documented event types:
   - User → server: `ADD_MESSAGE.USER.TEXT` (composer input and conversation starters), `ADD_MESSAGE.USER.DIRECT_CALL` (every quick-reply tap — always DIRECT_CALL, never USER.TEXT, copying any `target`/`payload` verbatim)
   - Server → client: `ADD_MESSAGE.ASSISTANT.TEXT` (and `APPEND_LAST_ASSISTANT_MESSAGE` streaming chunks), `ADD_MESSAGE.ASSISTANT.CAROUSEL`, `ADD_MESSAGE.ASSISTANT.QUICK_REPLY`, `ADD_MESSAGE.ASSISTANT.COLD_START`, `ADD_MESSAGE.ASSISTANT.NOTIFICATION`, per-turn echoed/replayed user events, `METADATA.SELECT_AGENT`. Other event types are accepted silently and visible in the debug panel — that is required behaviour, not incidental: the stream also carries internal event types excluded from `../openapi-spec.json`, and new ones may be added without that counting as a breaking change, so an unrecognised `type` must never raise.
   - `ADD_MESSAGE.ASSISTANT.TEXT` is markdown. `mdRender()` supports a deliberately small subset — bold, italic, unordered/ordered lists and links — and builds DOM nodes rather than an HTML string, so assistant text is only ever inserted as a text node. Link URLs are accepted only for `http:`, `https:` and `mailto:`; anything else (`javascript:`, `data:`, …) is left as literal text. If you extend it, keep that shape: switching to `innerHTML` turns a formatting helper into an XSS surface.
   - `SYNC_EVENT_LOG.META` is read but never displayed, because it describes the sync response rather than the conversation. It carries `hasMore` and `nextCursor`, which are the only way to request older history. A client that ignores this event shows just the most recent part of a long chat, with nothing to indicate that earlier messages exist.
   - `ERROR` events are backend telemetry (non-fatal warnings such as `AGENT.ERROR`); the client logs them to the debug panel and does **not** show them to the user.
   - `FATAL_ERROR` events render the agent's `translated.errorMsg` fallback and disable the composer. The raw `event.text` is never shown to the user.
   - `ADD_MESSAGE.ASSISTANT.NOTIFICATION` events are rendered as a single, in-place progress chip that updates as new notifications arrive. A "Thinking…" placeholder is shown immediately on submit; the chip stays visible while messages stream in and is cleared only when the request completes (all response events received).

7. **Request concurrency.** While a `send-event` request is in flight, the composer, quick-reply buttons, and conversation-starter buttons are disabled. The client matches the backend's 60-second server timeout with an `AbortController`. On timeout, a fallback error is shown and the composer is re-enabled.

8. Streaming responses are parsed using the JSON-array-stream pattern documented in `documentation/02-how-the-chat-integration-works.md` (buffer + try-parse + try-parse-with-closing-bracket).

9. **History paging.** When `SYNC_EVENT_LOG.META` reports `hasMore`, a **Load earlier messages** button appears at the top of the thread. It calls `GET .../chats/{chatId}/history?after=<cursor>&limit=20`, walking backwards one page at a time. Pages arrive oldest-first and are inserted *above* the existing thread, with the scroll position adjusted so the shopper keeps looking at the same message. The button is driven by `hasMore`, never by how many events a page returned — a page can be short, or empty, while history remains.

## UI controls

- **Load earlier messages** — appears above the thread while older history exists. Fetches the previous page from the `history` endpoint and prepends it. Hidden once the start of the conversation is reached.
- **New chat** — rotates `chatId` and clears the message list. `endCustomerId` is preserved (same user, new conversation). Previous `chatId`s are archived in `localStorage` under `clarityTest.chatHistory` for inspection.
- **Debug** — toggles a panel showing the raw inbound event stream. The panel also contains HTTP error simulation buttons for testing UI-only handling of 400, 429, and 500 responses without calling the backend.
- **Reset** — clears the onboarding values and returns to the form. `endCustomerId` is preserved.

## Testing HTTP error handling

Open the **Debug** panel and use the simulation buttons:

- **400** — displays the validation retry fallback (`translated.tryAgain`, or `Please try again.`).
- **429** — displays the rate-limit message: `Something went wrong, please try again in a minute.`
- **500** — displays the server-error message: `Something went wrong, please try again later.`

These buttons simulate UI behavior only; they do not call the backend. Real `5xx` responses from `send-event` are retried briefly before showing the server-error message. `400` and `429` responses are not retried.

## CORS

Browser `fetch` calls from this client will reach `apiUrl` only if the backend allows the origin (`null` when opened from disk, `http://localhost:8000` when served locally).

If the first `general-settings` request fails with a network error and no HTTP status, it is almost certainly CORS. Options:

1. Ask Bloomreach to allow your origin during the evaluation.
2. Run a permissive local CORS proxy in front of `apiUrl` and point the client at the proxy.
3. Use `curl` instead of this client to validate the API contract without the browser CORS layer.

The client surfaces a CORS hint in the error message when it detects this case.

## localStorage keys

| Key | Contents |
|---|---|
| `clarityTest.onboarding` | `{ apiUrl, agentId, apiToken, currency }` |
| `clarityTest.endCustomerId` | Stable UUID for the simulated user |
| `clarityTest.chatId` | Current conversation ID |
| `clarityTest.chatHistory` | Archive of previous chat IDs (one entry per "New chat" click) |
| `clarityTest.settings` | `general-settings` response cache: `{ cachedAt, agentId, data }`. TTL: 6 hours. |

Conversation-starter suggestions are not persisted; they are fetched on demand from `GET /ca/v1/agents/{agentId}/suggestions` with the Bearer token as the user types.

Clear all of them via your browser's DevTools → Application → Local Storage to start completely fresh.

## Known simplifications

- Uses UUID v4 (`crypto.randomUUID()`) for event and chat IDs. The docs recommend UUID v7 for sortability; v4 works because the server doesn't validate the version.
- Sends only `FE.SET_CONTEXT.currency` proactively. The value comes from onboarding and must be a valid ISO 4217 code. Add item/product context if you want to exercise PDP/PLP-specific behavior.
- Does not implement file upload, surveys, live-agent handoff, or `customerSettings.customized_ui_attributes` rendering hints.
- Renders product cards with a generic field set (image, title, price, link). To exercise `customized_ui_attributes`, extend `makeCard()`.

## Doc validation checklist

Run through these once against a real backend to confirm the docs are sufficient:

- [ ] `general-settings` returns and the assistant name/logo/placeholder all populate from the response.
- [ ] A brand-new empty chat shows default starter questions below the input/Send row.
- [ ] Typing at least two characters in the composer fetches search-triggered conversation-starter buttons below the input/Send row when suggestions are available.
- [ ] Tapping a conversation-starter button sends that question as a normal user message.
- [ ] A "hello" message produces a streaming reply rendered as a single bubble (multiple `APPEND_LAST_ASSISTANT_MESSAGE` chunks aggregating into one `ADD_MESSAGE.ASSISTANT.TEXT`).
- [ ] If the assistant emits a carousel, cards render with image/title/price/link.
- [ ] If the assistant emits quick replies, tapping any one dispatches `ADD_MESSAGE.USER.DIRECT_CALL` (always DIRECT_CALL, never USER.TEXT; visible in DevTools Network).
- [ ] "New chat" rotates `chatId` and the next message exchange uses the new ID.
- [ ] Reload preserves `endCustomerId`, `chatId`, and onboarding. The chat is re-hydrated via `SYNC_EVENT_LOG` (debug panel shows replayed events).
- [ ] In a conversation longer than 20 events, reloading shows **Load earlier messages**; clicking it prepends the previous page without moving the visible message, and the button disappears at the start of the chat.
- [ ] The debug panel shows exactly one `SYNC_EVENT_LOG.META` per sync, carrying `hasMore` and `nextCursor`, and it appears there only.
- [ ] Misconfiguring `apiUrl` shows a clear error and returns to the onboarding form.

If anything on the checklist fails for a reason not described in the docs, that's a documentation gap.
