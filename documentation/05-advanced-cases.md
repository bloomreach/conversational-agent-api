[← Back to Rich messages](04-rich-messages.md)

# 5. Advanced cases

Direct calls triggered by quick replies, context synchronization, history restoration, feedback, and error handling. These power the richer flows and keep the UI in sync with the backend.

## Direct call <sup>`Outbound`</sup> (echoed)

`ADD_MESSAGE.USER.DIRECT_CALL`

```
target ─ <server-provided string>

// copied verbatim from the quick-reply
// option Clarity sent — never invented
// or hardcoded by the client
```

### Return a server-provided quick-reply target

```ts
{ _id: string,
  type: "ADD_MESSAGE.USER.DIRECT_CALL",
  sentDate: string,              // ISO date-time
  target?: string,
  source?: string,
  text?: string,
  invisible?: boolean,
  payload?: object }
```

Sent for **every** quick-reply selection — always `DIRECT_CALL`, never `USER.TEXT` — whether or not the option carries a `target`/`payload`. The client should not invent targets; copy any server-provided `target`/`payload` back **verbatim**, preserving unknown fields. `invisible: true` hides it from history.

> **Public integration rule:** treat `target` values as server-owned routing hints. Your client should only return values it received from Clarity in a quick reply; do not hardcode or expose an independent picker of backend targets.

## Built-in button action <sup>`Outbound`</sup> (echoed)

`ADD_MESSAGE.USER.GEN_BY_BTN` · `ADD_MESSAGE.USER.COMPARE`

<img src="images/evt-gen-btn.svg" align="right" width="260" alt="Mock chat showing a built-in button action being selected" />

### API event sent after selecting a built-in UI action

```ts
{ _id: string,
  type: "ADD_MESSAGE.USER.GEN_BY_BTN",
  sentDate: string,              // ISO date-time
  text: "SHOW_SIMILAR" | "COMPARISON",
  label?: string }

// replay-only:
{ _id: string,
  type: "ADD_MESSAGE.USER.COMPARE",
  sentDate: string,              // ISO date-time
  ids: string[] }
```

`GEN_BY_BTN` is the API event for a small set of built-in actions such as "show similar" or "compare". The UI label can be shopper-friendly, but the event text carries the fixed intent value expected by the backend. Like other user events, it is echoed back on the turn — de-duplicate the streamed copy by `_id`. `COMPARE` is a replay-only user event surfaced during history restoration.

<br clear="right" />

## Set context <sup>`Both`</sup>

`FE.SET_CONTEXT`

```ts
// tell the assistant what's on screen
{
  currentItemIds: ["prod-123"],
  currentItemIdsType: "product_id",
  cartItemIds: […],
  currency: "USD",
  plpCategoryName?, miniPageProduct?,
  remove?: ["pageList", …]
}
```

### Sync the shopper's current view

```ts
{ _id: string,
  type: "FE.SET_CONTEXT",
  sentDate: string,              // ISO date-time
  currentItemIds?: string[],
  currentItemIdsType?: "product_id" | "item_id",
  currentItemId?: string,
  cartItemIds?: string[],
  miniPageProduct?: ProductItem,
  userContextFilter?: object,
  currency?: string,             // ISO 4217, e.g. "USD"
  plpCategoryName?: string,
  plpCategoryDescription?: string,
  urlQueryParams?: object,
  remove?: string[],
  uid?: string }
```

Send whenever page / cart / filter state changes so responses stay relevant. Pass the FE-configured `currency` here. Use `remove` to clear previously sent context groups, such as page-list or cart state. The server may also assert context state back with the same object — apply it to local state.

## History restoration <sup>`Outbound`</sup>

`SYNC_EVENT_LOG` · `PERSIST_COLD_START`

<img src="images/evt-sync.svg" align="right" width="260" alt="Mock chat showing history replayed from the server" />

### Replay past events

```ts
{ _id: string,
  type: "SYNC_EVENT_LOG",
  sentDate: string,              // ISO date-time
  lastProcessedEventId?: string,
  welcomeUnnecessary?: boolean }
```

Send on initial mount only when reopening an existing `chatId`. The server replays past events back through the response stream — including user messages. De-duplicate by `_id` since they may already exist locally. Skip this for a brand-new chat.

`PERSIST_COLD_START` stores welcome-screen events so they can be replayed later. Use it to persist the `ADD_MESSAGE.ASSISTANT.COLD_START` welcome message; sending the cold-start event itself does not save it.

<br clear="right" />

## Feedback <sup>`Outbound`</sup>

`ADD_MESSAGE.USER.FEEDBACK`

<img src="images/evt-feedback.svg" align="right" width="260" alt="Mock chat showing a feedback / rating prompt" />

### Rate a response or the conversation

```ts
{ _id: string,
  type: "ADD_MESSAGE.USER.FEEDBACK",
  sentDate: string,              // ISO date-time
  score?: number,
  text?: string,
  messages?: string[] }
```

Powers both per-message thumbs up/down and the survey overlay. `score` is the rating, `text` the optional free-text, `messages` the message IDs being rated.

<br clear="right" />

## Errors <sup>`Inbound`</sup>

`ERROR` · `FATAL_ERROR`

<img src="images/evt-errors.svg" align="right" width="260" alt="Mock chat showing the fatal-error fallback message" />

### Error events

```ts
{ _id?: string,
  type: "ERROR" | "FATAL_ERROR",
  sentDate?: string,             // ISO date-time
  text?: string,
  exception?: object,
  request?: object }
```

> **`ERROR`** — backend telemetry, **not user-facing**. Ignore in the UI (a debug panel is fine). The stream continues normally.

> 🛑 **`FATAL_ERROR`** — show `translated.errorMsg` (never `event.text`), stop the current stream, and allow the shopper to try again or start a new chat.

<br clear="right" />

---

[← Chapter 4 — Rich messages](04-rich-messages.md) · [Chapter 6 — Conversation starters →](06-conversation-starters.md)
