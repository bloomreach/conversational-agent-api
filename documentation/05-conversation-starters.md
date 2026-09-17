[← Back to Advanced cases](04-advanced-cases.md)

# 5. Conversation starters

Pre-chat suggestions from public Clarity Search APIs. Call these **before** the first `send-event`. When the shopper selects one, send its text as a normal `ADD_MESSAGE.USER.TEXT`. These paths use the same public V1 prefix and require the Bearer token: `/ca/v1/agents/{agentId}/catalog/...`

## PDP — product detail page <sup>`Inbound`</sup>

### Questions for the item being viewed

| Operation | Endpoint · questions at |
|---|---|
| `getProductById` | `GET /catalog/items/{itemId}` → `item._questions` |
| `getProductsById` | `POST /catalog/items` → `items[]._questions` |
| `getProductQuestionsById` | `GET /catalog/items/{itemId}/questions` → `questions` |
| `getParentProduct` | `GET /catalog/parent_product/{product_id}` → `parent_product.questions` |
| `getParentProducts` | `POST /catalog/parent_products` → `parent_products[].questions` |

Common controls: `skipQuestionSelection` (default false), `limitQuestions` (default 5), plus `includeVariants`, `includeImplicitFilter`, `fields`, `limitVariants`.

## PLP — product listing page <sup>`Inbound`</sup>

`POST /catalog/plp` · `getPlpQuestions`

### Category-level questions from a product list

```ts
POST /catalog/plp
{ product_ids: ["product-1", "product-2"],
  max_questions: 5, plp_name? }
```

At least one of `item_ids` or `product_ids` is required. Questions at `response.plp.questions`; contributing categories at `response.plp.categories`.

## Search / autosuggest <sup>`Inbound`</sup>

`GET /suggestions` · `getSuggestions`

### Suggestions for the shopper's typed query

```
GET /suggestions?q=leather+boot
  &include_keywords=true&limit_questions=5&limit_keywords=5
```

**Autosuggest** means suggestions shown while the shopper is typing in a search box, before they submit a full search. `q` is **required** — this endpoint is not a source of empty-page defaults. For an empty generic search chat, use local fallback placeholders instead. With `include_keywords=true` it returns `response.suggestions.questions` and `response.suggestions.keywords`.

Params: `q` (req), `query_type` (default keyword), `include_products`, `include_keywords`, `limit_questions`, `limit_products`, `limit_keywords`.

## Shared question type

```ts
// QuestionDTO
{ identifier?: string,
  question?: string,
  answer?: string,
  weight?: number,
  topic?: string,
  subtopic?: string,
  mini_question?: string }
```

`question` is the shopper-facing text. `answer` may be empty until enrichment completes. `topic`/`subtopic`/`mini_question` are optional display/grouping metadata.

---

[← Chapter 4 — Advanced cases](04-advanced-cases.md) · [Chapter 6 — Reference →](06-reference.md)
