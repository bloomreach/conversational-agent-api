# <img src="images/bloomreach-logo.svg" width="32" height="32" alt="Bloomreach logo" /> Conversational Agent API — Frontend Integration Guide

This guide explains how to build a chat UI for Conversational Agent. The product is called Conversational Agent, while the public API is called Conversational Agent API.
The [`openapi-spec.json`](../openapi-spec.json) is the source of truth — when this guide and the spec disagree, the spec wins.

## Contents

**Getting Started** (this page)

1. [How the chat integration works](01-how-the-chat-integration-works.md)
2. [Basic event types (messages)](02-basic-events.md)
3. [Rich messages](03-rich-messages.md)
4. [Advanced cases](04-advanced-cases.md)
5. [Conversation starters](05-conversation-starters.md)
6. [Reference](06-reference.md)

---

## Getting Started

### Obtain integration credentials

Before integrating the API, obtain the **agent ID** and an **API token**. Bloomreach should provide the **API URL** for your environment.

#### Create a new API token

1. In the left menu, select **Conversational Agent** > **API**.
2. Click **+ New token**.
3. Enter a **token name**.
4. Optionally, add a **description** of what the token is used for.
5. Click **Generate token**.
6. Copy the generated token to the clipboard and store it securely for use by your integration.

The [Manage API tokens](https://documentation.bloomreach.com/clarity/reference/manage-api-tokens) guide explains how to manage and revoke active tokens.

#### Find the agent ID and API URL

1. In the left menu, select **Conversational Agent** → **Agents**. In the table, find the agent you want to integrate and hover over its row. Click the dropdown menu next to its **Edit** button, then select **View Agent ID**.
2. Use the API URL provided by Bloomreach for your environment.

Your integration configuration should look like this:

```js
const apiUrl = 'https://<your-api-host>'
const agentId = '<your-agent-id>'
const apiToken = '<your-token>'
```

> **Browser versus server-side integration:** the browser-based sample clients send the API token directly from the customer storefront. This is an intentional client-side integration model: visitors can inspect browser requests and may be able to access the token. If you need full control over the credential and do not want it exposed to browsers, make the protected API requests from your own backend instead. Your storefront can call your backend, while your backend stores the token securely and forwards authenticated requests to Bloomreach.

### Make your first request

Verify your API URL, agent ID, and API token by fetching `general-settings`. This authenticated endpoint returns the agent branding and translations that the chat UI uses.

```bash
curl -H "Authorization: Bearer <api-token>" https://<your-api-host>/ca/v1/agents/<agentId>/general-settings
```

A successful response confirms that the API URL and agent ID are correct. Use the returned branding and translations when you initialize the chat UI.

### Initialization flow

Bringing the chat client to life is a short, ordered sequence. First, gather your [required integration configuration](#static-setup-and-runtime-identifiers) — the API URL, agent ID, API token, and storefront currency. Then, as the chat client mounts, run three steps in order: [fetch branding & translations](#step-1--fetch-branding--translations-inbound) so the UI is fully localized before it paints, [sync the event log](#step-2--restore-existing-history-outbound), which replays past messages for a conversation already under way, and — when it returns nothing — [greet the new chat](#step-3--greet-a-new-chat-outbound) with a cold start. [Context](#before-the-first-message--set-the-current-context-outbound) is then sent right before the shopper's first message: opening the chat surface stores nothing until the shopper writes.

A long conversation replays only its newest page, so the sync response opens with the cursor to everything older, and a **Load earlier messages** button walks backwards through the rest one page at a time. [Chapter 1 · From mount to history](01-how-the-chat-integration-works.md#from-mount-to-history) draws the whole sequence, paging loop included.

From here on, every interaction is modeled as an **event**. On each chat turn, the client sends one JSON object to `send-event`: an `event`, the current page `url`, and the shopper identifier `endCustomerId`. The server responds with a streaming JSON array of inbound events that the UI renders into the conversation thread. Events flow in one of three directions:

- **Outbound** — client → server.
- **Inbound** — server → client.
- **Both** — replayed from history or echoed back by the server.

The following sections start with the required setup, then describe the runtime calls and each event type in more detail.

### Static setup and runtime identifiers

Everything the client needs falls into three groups, distinguished by who owns each value and when it's set.

| Bucket | Values | Notes |
|---|---|---|
| **Bloomreach** | `apiUrl`, `agentId`, `apiToken` | Issued at onboarding. Use `apiUrl` as the host, `agentId` in the path, and send the token as `Authorization: Bearer <token>` on every API request. |
| **Frontend / storefront** | `currency` | ISO 4217 (`USD`, `GBP`…). Read this from your storefront or merchant configuration before initialization; use it to format prices and pass it in `FE.SET_CONTEXT`. |
| **Runtime** | `endCustomerId`, `chatId` | `endCustomerId` identifies the shopper/end user, typically from a stable cookie. `chatId` identifies one conversation and is generated & persisted by the client. One shopper may have many chats over time. |

> **Chat ID:** generate a fresh `chatId` with a UUID v7 library the first time the chat surface opens, persist it in `localStorage`, and rotate it on "New chat". `endCustomerId` never changes when a new chat starts.
>
> ```js
> import { v7 } from 'uuid'
> const chatId =
>   localStorage.getItem('CHAT_ID') ??
>   (() => { const id = v7(); localStorage.setItem('CHAT_ID', id); return id })()
> ```

### Runtime API calls

The whole integration is a one-time settings fetch, a single streaming chat channel, a history endpoint for older events, and optional pre-chat [conversation starters](05-conversation-starters.md). All endpoints use the `/ca/v1/agents/{agentId}` route family and require `Authorization: Bearer <api-token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/ca/v1/agents/{agentId}/general-settings` | Branding + full i18n dictionary. Called once on mount, cached. Bearer token required. |
| `POST` | `/ca/v1/agents/{agentId}/chats/{chatId}/send-event` | The whole chat channel: one outbound event in, a stream of inbound events back. Bearer token required. |
| `GET` | `/ca/v1/agents/{agentId}/chats/{chatId}/history?after=…` | [Older events](04-advanced-cases.md#history-paging-inbound) beyond the page a sync replayed. Bearer token required. |
| `GET` | `/ca/v1/agents/{agentId}/catalog/items/{itemId}` | [PDP](05-conversation-starters.md#pdp--product-detail-page-inbound) starter questions for the product on the page. Bearer token required. |
| `POST` | `/ca/v1/agents/{agentId}/catalog/plp` | [PLP](05-conversation-starters.md#plp--product-listing-page-inbound) category-level questions from a product list. Bearer token required. |
| `GET` | `/ca/v1/agents/{agentId}/suggestions?q=…` | [Search](05-conversation-starters.md#search--autosuggest-inbound) autosuggest questions for a typed query. Bearer token required. |

The first three are the **core** surface; the three `clarity-search` paths are optional **conversation starters** shown before the first message. See [Chapter 5](05-conversation-starters.md) for their request/response details.

### Step 1 — Fetch branding & translations <sup>`Inbound`</sup>

`GET /ca/v1/agents/{agentId}/general-settings`

Call `general-settings` once on mount and cache it for the session. This authenticated endpoint returns agent branding (`assistantLogo`, `assistantName`, `agentPersonaName`, `description` — all nullable) plus the full `translated` dictionary for every UI string. Apply it before rendering so the header, placeholders, buttons and error messages are all localized.

```js
const getGeneralSettingsCached = async () => {
  const cached = readCache('SETTINGS', AGENT_ID)  // 6h TTL
  if (cached) return cached
  const res = await fetch(
    `${apiUrl}/ca/v1/agents/${AGENT_ID}/general-settings`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    })
  const settings = await res.json()
  writeCache('SETTINGS', settings)
  return settings
}

applyBrandingAndI18n(await getGeneralSettingsCached())
```

- Always provide neutral local fallbacks — branding fields are often `null`.
- `assistantLogo` is a **URL**, not base64.
- `staticReplies.notificationThinking` is the "Thinking…" placeholder before streaming starts.
- `translated.errorMsg` is the fallback shown on `FATAL_ERROR` — never show raw error text.
- `customerSettings.customized_ui_attributes` lists extra product attributes to render on cards / mini-PDPs.

> **Cache** the response in `localStorage` for up to **6 hours**, keyed by `agentId`. On failure, fall back to a stale entry rather than losing branding.

### Step 2 — Restore existing history <sup>`Outbound`</sup>

`SYNC_EVENT_LOG` via send-event

Steps 2 and 3, and every chat turn after them, post to `send-event`, so define one small helper to reuse:

```js
const sendEvent = (eventBody, extra = {}) =>
  fetch(`${apiUrl}/ca/v1/agents/${AGENT_ID}/chats/${chatId}/send-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify({
      event: { _id: v7(), sentDate: new Date().toISOString(), ...eventBody },
      url: window.location.href,
      endCustomerId,
      ...extra,
    }),
  })
```

Send the sync on every mount, and again after every **New chat** — for a brand-new `chatId` as much as an existing one. What differs is the answer, not whether you ask. Reopening a conversation replays its past events so the thread is restored; de-duplicate them by `_id`, since they may already exist locally. A chat whose shopper was greeted but has not written yet replays that greeting (the server keeps it for 24 hours). A brand-new `chatId` has nothing to replay and gets an empty array — greet it in Step 3. See [`SYNC_EVENT_LOG`](04-advanced-cases.md#history-restoration-outbound) for details.

```js
sendEvent({ type: 'SYNC_EVENT_LOG' })
```

A sync replays only the newest page of a long conversation, so the response opens with a `SYNC_EVENT_LOG.META` event carrying `hasMore` and a cursor for everything older. Handle it — otherwise a shopper returning to a long chat sees a truncated thread that looks complete. See [History paging](04-advanced-cases.md#history-paging-inbound).

### Step 3 — Greet a new chat <sup>`Outbound`</sup>

`ADD_MESSAGE.ASSISTANT.COLD_START` via send-event

When the sync returned nothing, ask for the greeting: send a cold start with the welcome text from `general-settings` (`translated.welcomeMessage`). The server echoes the request and streams the greeting as `ADD_MESSAGE.ASSISTANT.TEXT` (plus quick replies or products, depending on the agent). Render the greeting, not the echo. See [Welcome / cold start](02-basic-events.md#welcome--cold-start-both).

```js
const coldStart = { _id: v7(), sentDate: new Date().toISOString(),
  type: 'ADD_MESSAGE.ASSISTANT.COLD_START',
  text: settings.translated.welcomeMessage }
sendEvent(coldStart)
```

A greeting nobody answers creates no conversation: nothing is stored, and it expires after 24 hours. The shopper's first message stores it in front of the conversation. Send the cold starts on screen as `openingInputs` with that first message, so the greeting is stored even if it has expired in the meantime:

```js
sendEvent({ type: 'ADD_MESSAGE.USER.TEXT', text }, { openingInputs: [coldStart] })
```

### Before the first message — set the current context <sup>`Outbound`</sup>

`FE.SET_CONTEXT` via send-event

Tell the assistant what is shown in the outer storefront page so replies stay relevant: the configured `currency`, plus whatever the surface knows about (product IDs, cart contents, category, filters). Send it **right before the shopper's first message**, and again whenever the page or cart changes after that — **never on mount**. See [`FE.SET_CONTEXT`](04-advanced-cases.md#set-context-both) for the full field list.

```js
await sendEvent({
  type: 'FE.SET_CONTEXT',
  currentItemIds: ['prod-123'],
  currentItemIdsType: 'product_id',
  currency: 'USD',
})
```

---

Next: [Chapter 1 — How the chat integration works](01-how-the-chat-integration-works.md)
