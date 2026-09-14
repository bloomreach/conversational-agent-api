[← Back to Conversation starters](06-conversation-starters.md)

# 7. Reference

## Status codes

| Code | Meaning | Action |
|---|---|---|
| `200` | Stream of events. Read until `]`. | Parse the streaming JSON array; render events as they arrive. |
| `400` | Invalid event format / missing field. | Send valid event objects and required request fields. |
| `404` | Unknown `agentId` or `chatId`. | Verify the identifiers. |
| `409` | Conflict with current resource state. | Re-check context; retry only after the state changes. |
| `429` | Rate-limited. | Back off; don't retry in a tight loop. |
| `500` | Backend error (may still emit `ERROR`/`FATAL_ERROR`). | Contact Bloomreach if it persists. |

Network drops are normal during streaming — handle `TypeError: network error` (e.g. on page refresh) silently.

## Event catalog

| Event type | Direction | Purpose |
|---|---|---|
| `ADD_MESSAGE.USER.TEXT` | Out, echo | Shopper types a message. |
| `ADD_MESSAGE.USER.GEN_BY_BTN` | Out, echo | Built-in action selected from the UI (SHOW_SIMILAR / COMPARISON). |
| `ADD_MESSAGE.USER.DIRECT_CALL` | Out, echo | Quick-reply selection; always sent as DIRECT_CALL, copying a server-provided target/payload when present. |
| `ADD_MESSAGE.USER.COMPARE` | Replay | Replay-only compare selection. |
| `ADD_MESSAGE.USER.FEEDBACK` | Out | Rate a response / conversation. |
| `SYNC_EVENT_LOG` | Out | Request conversation history replay. |
| `PERSIST_COLD_START` | Out | Persist welcome state for replay. |
| `FE.SET_CONTEXT` | Both | Current page / cart / filter / currency state. |
| `SELECTED_ITEMS` | Both | Selected products (compare). |
| `ADD_MESSAGE.ASSISTANT.TEXT` | In | Assistant text message (markdown). |
| `APPEND_LAST_ASSISTANT_MESSAGE` | In | Streaming chunk to fold into last text. |
| `ADD_MESSAGE.ASSISTANT.NOTIFICATION` | In | In-place progress indicator. |
| `ADD_MESSAGE.ASSISTANT.COLD_START` | Both | Welcome / initial message. |
| `ADD_MESSAGE.ASSISTANT.CAROUSEL` | In | List of products. |
| `ADD_MESSAGE.ASSISTANT.QUICK_REPLY` | In | Selectable suggestion buttons. |
| `ERROR` | In | Non-fatal telemetry — do not surface. |
| `FATAL_ERROR` | In | User-facing error → show `errorMsg`. |

> ⚠️ **This table is the supported set, not everything the stream can contain.** The backend also emits internal event types that are intentionally excluded here, and may add more without that being a breaking change. Handle the types above and ignore anything else — see [Streaming responses](02-how-the-chat-integration-works.md#streaming-responses).

---

Documentation companion to [`openapi-spec.json`](../openapi-spec.json) (Bloomreach Conversational Agent API v1.0.0). The OpenAPI spec is the source of truth — when this guide and the spec disagree, the spec wins.

[← Chapter 6 — Conversation starters](06-conversation-starters.md) · [Back to Getting Started](README.md)
