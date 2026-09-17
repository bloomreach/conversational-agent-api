[← Back to Basic event types](02-basic-events.md)

# 3. Rich messages

Beyond plain text, the assistant emits structured product carousels, selectable quick replies, and selection state that ties into the message input's "compare" flow.

## Product carousel <sup>`Inbound`</sup>

`ADD_MESSAGE.ASSISTANT.CAROUSEL`

<img src="images/evt-carousel.svg" width="320" alt="Mock chat showing a scrollable product carousel" />

### A list of products

```ts
{ _id: string,
  type: "ADD_MESSAGE.ASSISTANT.CAROUSEL",
  sentDate: string,              // ISO date-time
  data: ProductItem[],           // required
  categoryName?: string,
  rephrasedQuery?: string,
  batchId?: string,              // one reply, many events
  _metadata?: { engVer?: string; queries?: string[] } }
```

Render product cards (image, title, price, tags, add-to-cart). There is no default "See all results" button; a merchant may optionally configure one to route shoppers to a storefront search page, using `_metadata.queries` to reproduce the result set.

**ProductItem:** `id` (required), `url`, `title`, `image`, `price`, `originalPrice`, `currency`, `description`, `variantAttributeList`, `questions`, `variants`, `__categories`, `extraVariantFields`. Format prices with the context currency when `currency` is omitted.

## Quick replies <sup>`Inbound`</sup>

`ADD_MESSAGE.ASSISTANT.QUICK_REPLY`

<img src="images/evt-quick-reply.svg" width="320" alt="Mock chat showing selectable quick-reply chips" />

### Selectable suggestion buttons

```ts
{ _id: string,
  type: "ADD_MESSAGE.ASSISTANT.QUICK_REPLY",
  sentDate: string,              // ISO date-time
  data: {                        // required
    label: string,
    target?: string,
    payload?: object
  }[],
  text?: string,
  batchId?: string }             // one reply, many events
```

> **On select:** always send an `ADD_MESSAGE.USER.DIRECT_CALL` with the `label` as `text`, regardless of the `target`/`payload` value. When the option carries a `target`/`payload`, copy it **verbatim**; when it does not, still send `DIRECT_CALL` with just the `label` (never `USER.TEXT`).

## Selected items <sup>`Both`</sup>

`SELECTED_ITEMS`

<img src="images/evt-selected-items.svg" width="320" alt="Mock chat showing selected product chips above the message input" />

### The shopper picked items (e.g. from a carousel)

```ts
{ _id: string,
  type: "SELECTED_ITEMS",
  sentDate: string,              // ISO date-time
  ids: string[],                 // required
  data?: ProductItem[],
  generatedFromAI?: boolean,     // true when created by the assistant
  isSelectedFromLastBotResponse?: {          // keyed by product id
    [id: string]: boolean } }
```

Drives the "compare" chips above the message input. Sent outbound when the user selects; also replayed inbound to restore selection state. Same object both directions.

### How selection and the carousel fit together

The two are halves of one flow, joined by `ProductItem.id`. A carousel's `data[].id` is the only handle the backend has on a product, and it is exactly what goes into `ids`:

1. **The assistant sends a carousel.** You render a card per `ProductItem`, each carrying its `id`.
2. **The shopper picks cards.** How they pick is your UI's business — a checkbox on the card, a tap, a long-press; the API has no opinion. What it expects back is one `SELECTED_ITEMS` carrying the ids of everything currently selected. The event **replaces** the selection rather than adding to it — the backend folds only the most recent one and ignores every earlier one — so always send the complete set, and send `ids: []` to clear it.
3. **You render the chips.** The selected products appear above the message input, which is what makes the selection visible and removable.
4. **The shopper acts on them.** A built-in action such as compare or show-similar goes out as [`GEN_BY_BTN`](04-advanced-cases.md#built-in-button-action-outbound-echoed) with `text: "COMPARISON"` or `"SHOW_SIMILAR"`. Note it carries no ids of its own — the backend acts on the selection you last sent, so the `SELECTED_ITEMS` has to precede it.

Selection is not only the shopper's to make. An inbound `SELECTED_ITEMS` with `generatedFromAI: true` means the assistant chose the items; apply it to your chips exactly as you would the shopper's own.

Two fields keep the event usable when the carousel that produced it is no longer in memory:

- **`data`** — the full `ProductItem[]`, not just ids. Carousels fall outside the loaded window as a chat grows, so without this a restored chip has an id and nothing to draw. Use it when present, and fall back to looking the ids up in the carousels you still hold.
- **`isSelectedFromLastBotResponse`** — a map of product id to boolean, marking which selected items came from the newest assistant carousel rather than an earlier one. Useful when "compare these" should mean the latest results only.

On reopening a chat, do not rebuild the selection by replaying `SELECTED_ITEMS` yourself. [`SYNC_EVENT_LOG.META.state`](04-advanced-cases.md#history-restoration-outbound) already carries the fold over the whole conversation, including selections made against carousels on pages you have never loaded — restore from that, then apply only the `SELECTED_ITEMS` events newer than `stateAsOfSentDate`.

Be clear about what that snapshot is, though: `state.selectedList` is a list of `{ id, isSelectedFromLastBotResponse?, idType? }` and carries **no `ProductItem` payloads at all**. It restores *which* products are selected, never enough to draw them. For each restored id you still need the product from a carousel or a `SELECTED_ITEMS.data` array you hold locally, and for a selection made against a carousel you have not paged in, you will hold neither — resolve those against your own catalogue, or render the chip in a pending state until you can.

---

[← Chapter 2 — Basic event types](02-basic-events.md) · [Chapter 4 — Advanced cases →](04-advanced-cases.md)
