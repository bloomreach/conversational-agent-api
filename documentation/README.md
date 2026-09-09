# <img src="images/bloomreach-logo.svg" width="32" height="32" alt="Bloomreach logo" /> Conversational Agent API — Frontend Integration Guide

This guide explains how to build a chat UI for Conversational Agent. The product is called Conversational Agent, while the public API is called Clarity.
The [`openapi-spec.json`](../openapi-spec.json) is the source of truth — when this guide and the spec disagree, the spec wins.

## Contents

1. **Getting Started** (this page)
2. [How the chat integration works](02-how-the-chat-integration-works.md)
3. [Basic event types (messages)](03-basic-events.md)
4. [Rich messages](04-rich-messages.md)
5. [Advanced cases](05-advanced-cases.md)
6. [Conversation starters](06-conversation-starters.md)
7. [Reference](07-reference.md)

---

## 1. Getting Started

### Create an API token and find the agent ID

Before integrating the API, obtain the **agent ID** and an **API token**. Bloomreach should provide the **API URL** for your environment.

1. In the left menu, select **Clarity** → **API**.
2. Click **+ New token** and fill in the form.
3. Copy the generated token to the clipboard and store it securely for use by your integration.
4. In the left menu, select **Clarity** → **Agents**. In the table, find the agent you want to integrate and hover over its row. Click the dropdown menu next to its **Edit** button, then select **View Agent ID**.
5. Use the API URL provided by Bloomreach for your environment.

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

Bringing the chat client to life is a short, ordered sequence. First, gather your [required integration configuration](#static-setup-and-runtime-identifiers) — the API URL, agent ID, API token, and storefront currency. Then, as the chat client mounts, run three steps in order: [fetch branding & translations](#step-1--fetch-branding--translations-inbound) so the UI is fully localized before it paints, [push the current storefront context](#step-2--set-the-current-context-outbound) so replies are relevant to what is shown in the outer storefront page, and — only when reopening an existing conversation — [hydrate the history](#step-3--restore-existing-history-outbound) so past messages reappear.

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

The whole integration is a one-time settings fetch, a single streaming chat channel, and optional pre-chat [conversation starters](06-conversation-starters.md). All endpoints use the `/ca/v1/agents/{agentId}` route family and require `Authorization: Bearer <api-token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/ca/v1/agents/{agentId}/general-settings` | Branding + full i18n dictionary. Called once on mount, cached. Bearer token required. |
| `POST` | `/ca/v1/agents/{agentId}/chats/{chatId}/send-event` | The whole chat channel: one outbound event in, a stream of inbound events back. Bearer token required. |
| `GET` | `/ca/v1/agents/{agentId}/catalog/items/{itemId}` | [PDP](06-conversation-starters.md#pdp--product-detail-page-inbound) starter questions for the product on the page. Bearer token required. |
| `POST` | `/ca/v1/agents/{agentId}/catalog/plp` | [PLP](06-conversation-starters.md#plp--product-listing-page-inbound) category-level questions from a product list. Bearer token required. |
| `GET` | `/ca/v1/agents/{agentId}/suggestions?q=…` | [Search](06-conversation-starters.md#search--autosuggest-inbound) autosuggest questions for a typed query. Bearer token required. |

The first two are the **core** surface; the three `clarity-search` paths are optional **conversation starters** shown before the first message. See [Chapter 6](06-conversation-starters.md) for their request/response details.

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

### Step 2 — Set the current context <sup>`Outbound`</sup>

`FE.SET_CONTEXT` via send-event

Tell the assistant what is shown in the outer storefront page so replies stay relevant. Pass the configured `currency` here, plus whatever the surface knows about (product IDs, cart contents, category, filters). See [`FE.SET_CONTEXT`](05-advanced-cases.md#set-context-both) for the full field list.

Steps 2 and 3 both post to `send-event`, so define one small helper to reuse:

```js
const sendEvent = (eventBody) =>
  fetch(`${apiUrl}/ca/v1/agents/${AGENT_ID}/chats/${chatId}/send-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}` },
    body: JSON.stringify({
      event: { _id: v7(), sentDate: new Date().toISOString(), ...eventBody },
      url: window.location.href,
      endCustomerId,
    }),
  })
```

```js
sendEvent({
  type: 'FE.SET_CONTEXT',
  currentItemIds: ['prod-123'],
  currentItemIdsType: 'product_id',
  currency: 'USD',
})
```

### Step 3 — Restore existing history <sup>`Outbound`</sup>

`SYNC_EVENT_LOG` via send-event

Use this when the shopper reopens a previously started conversation and the client already has an existing `chatId`. Ask the server to replay past events so the thread is restored. **Skip this for a freshly rotated (brand-new) `chatId`** since there is nothing to replay. De-duplicate replayed events by `_id`. See [`SYNC_EVENT_LOG`](05-advanced-cases.md#history-restoration-outbound) for details.

```js
if (!isBrandNewChat) {
  sendEvent({ type: 'SYNC_EVENT_LOG' })
}
```

---

Next: [Chapter 2 — How the chat integration works](02-how-the-chat-integration-works.md)
