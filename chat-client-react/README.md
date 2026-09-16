# Conversational Agent — React + Vite Test Client

A TypeScript React implementation of the Conversational Agent API client described by [`../documentation/`](../documentation/README.md) and `../openapi-spec.json`.

## Features

- Runtime onboarding form for `apiUrl`, `agentId`, `apiToken`, `currency` (frontend-supplied valid ISO 4217 code), and `endCustomerId`
- Optional Vite env defaults via `.env`
- `GET /general-settings` with 6-hour `localStorage` cache and stale-cache fallback
- `POST /chat/{chatId}/send-event` streaming JSON-array parser
- `GET /chats/{chatId}/history` backwards paging: a **Load earlier messages** button driven by the `SYNC_EVENT_LOG.META` cursor, prepending pages without moving the shopper's scroll position
- Public Clarity Search API helpers for PDP, PLP, and search-triggered conversation-starter endpoints
- Search-sample fallback starter questions on an empty search chat
- Search-triggered suggestion buttons below the input box and Send button while the user types
- UUID v7 for chat and event IDs
- One user-initiated request in flight at a time
- 55-second `AbortController` timeout, slightly below the backend's 60-second connection timeout
- In-place assistant notifications / thinking state
- Assistant text streaming via `APPEND_LAST_ASSISTANT_MESSAGE`
- Product carousel, quick replies, per-turn echoed/replayed user events (de-duplicated by `_id`), fatal-error fallback
- Suggestion button clicks send the selected question as `ADD_MESSAGE.USER.TEXT`
- Debug panel for raw inbound events and UI-only HTTP error simulation

## Run

```bash
cd chat-client-react
npm install
npm run dev
```

Open the local Vite URL and enter onboarding values.

## Optional environment defaults

```bash
cp .env.example .env
```

Then edit:

```env
VITE_API_URL=https://your-api-host
VITE_AGENT_ID=your-agent-id
VITE_API_TOKEN=your-api-token
VITE_CURRENCY=GBP
```

The UI onboarding form still works and stores values in `localStorage`. `VITE_CURRENCY`/onboarding currency should be a valid ISO 4217 code such as `GBP`, `USD`, or `EUR`. All API requests, including `general-settings`, send `Authorization: Bearer <apiToken>` through the documented V1 agent route.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — TypeScript typecheck + production build
- `npm run preview` — preview production build
- `npm run typecheck` — TypeScript only

## Clarity Search endpoints

The React client exposes typed helpers in `src/api.ts` for all public Clarity Search conversation-starter endpoints now included in `../openapi-spec.json`:

- `getProductById` — `GET /catalog/items/{itemId}`
- `getProductsById` — `POST /catalog/items`
- `getProductQuestionsById` — `GET /catalog/items/{itemId}/questions`
- `getParentProduct` — `GET /catalog/parent_product/{productId}`
- `getParentProducts` — `POST /catalog/parent_products`
- `getPlpQuestions` — `POST /catalog/plp`
- `getSuggestions` — `GET /suggestions`

Chat history paging lives next to them in the same file:

- `getChatHistory` — `GET /chats/{chatId}/history`

The UI currently uses `getSuggestions` for the search/autosuggest sample flow: an empty search chat shows `SEARCH_FALLBACK_STARTER_QUESTIONS`, and typing at least two characters fetches search-triggered conversation starters from Clarity Search. PDP and PLP clients should use the contextual product/listing endpoints instead of these hard-coded fallback values. Suggestions are rendered below the composer row. They are progressive enhancement only — failures are logged and do not block chat.

## Testing HTTP error handling

Open the **Debug** panel and use the simulation buttons:

- **400** — displays the validation retry fallback (`translated.tryAgain`, or `Please try again.`).
- **429** — displays the rate-limit message: `Something went wrong, please try again in a minute.`
- **500** — displays the server-error message: `Something went wrong, please try again later.`

These buttons simulate UI behavior only; they do not call the backend. Real `5xx` responses from `send-event` are retried briefly before showing the server-error message. `400` and `429` responses are not retried.

## History paging

A `SYNC_EVENT_LOG` replays one bounded page, not the whole conversation. This client asks for a deliberately small one (`SYNC_EVENT_LOG_LIMIT = 20`, against a server default of 500) so paging is exercised on an ordinary chat; a production client can omit `limit` entirely.

The response opens with a `SYNC_EVENT_LOG.META` event. It describes the sync itself and feeds paging state rather than the thread: it carries `hasMore`, the `nextCursor` into older history, and a snapshot of the shopper's selection state folded over the whole chat. It is the **only** source of a history cursor, so a client that drops it shows the tail of a long conversation as though it were complete.

`loadOlderHistory` in `src/App.tsx` spends that cursor on `GET /chats/{chatId}/history?after=…`, one page at a time. Three details are worth copying into a real integration:

- **Pages are prepended, not appended.** Events come back oldest-first and are all older than what is on screen. `MessageList` detects the prepend and holds the viewport on the message the shopper was reading rather than jumping to either end.
- **The button is driven by `hasMore`, never by page length.** A page can come back short — empty, even — while history remains, because some events are filtered out after the page is selected.
- **Replayed events do not drive live turn state.** `historyEventsToMessages` is deliberately separate from the live `handleInboundEvent`: a page from last week must not move the progress indicator, change the active-agent badge, or re-trigger the fatal-error latch that disables the composer.

## Notes

If requests fail in the browser with a `TypeError: fetch failed`/network-style error, verify the API host, project/persona IDs, and CORS configuration for the Vite dev origin.

`ADD_MESSAGE.ASSISTANT.TEXT` is markdown. `src/markdown.tsx` renders a deliberately small subset — bold, italic, unordered/ordered lists and links — and returns React nodes rather than an HTML string, so assistant text is only ever rendered as text. Link URLs are accepted only for `http:`, `https:` and `mailto:`; anything else (`javascript:`, `data:`, …) is left as literal text. If you extend it, keep that shape: switching to `dangerouslySetInnerHTML` turns a formatting helper into an XSS surface.

The event switch in `src/App.tsx` ends in a `default` branch that ignores anything it does not recognise. That is required by the contract, not an oversight: the response stream also carries internal event types excluded from `../openapi-spec.json`, and new ones may be added without that counting as a breaking change. If you generate a client from the spec rather than hand-writing one, give its `oneOf`/discriminator deserializer a fallback — a strict one throws on an unmapped `type`.
