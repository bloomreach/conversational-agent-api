// Conversational Agent API helpers: request construction, settings cache, send-event streaming, and HTTP errors.
import { v7 as uuidv7 } from 'uuid'
import { LS, readJSON, writeJSON } from './storage'
import type {
  ChatHistoryPage,
  ClaritySearchResponse,
  GeneralSettings,
  OnboardingConfig,
  OutboundEvent,
  OutboundEventInput,
  ParentProductDTO,
  ParentProductRequestBody,
  PlpRequestBody,
  ProductDTO,
  ProductRequestBody,
  QuestionDTO,
  SuggestionsResponseBody,
} from './types'

// The integration guide under public/documentation/ now aligns the reference frontend cache with a 6-hour TTL.
export const SETTINGS_TTL_MS = 6 * 60 * 60 * 1000
// Stay a few seconds below the backend's 60-second connection timeout.
export const REQUEST_TIMEOUT_MS = 55 * 1000
export const SEND_EVENT_RETRY_ATTEMPTS = 2

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly responseText?: string,
  ) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`)
    this.name = 'HttpError'
  }
}

interface CachedSettings {
  cachedAt: number
  agentId: string
  data: GeneralSettings
}

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '')

const authHeaders = (config: OnboardingConfig): Record<string, string> => ({
  Authorization: `Bearer ${config.apiToken}`,
})

const claritySearchBase = (config: OnboardingConfig) =>
  `${trimTrailingSlash(config.apiUrl)}/ca/v1/agents/${encodeURIComponent(config.agentId)}`

function withQuery(url: string, params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value))
  }
  const query = qs.toString()
  return query ? `${url}?${query}` : url
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json', ...init?.headers }, ...init })
  if (!response.ok) throw new HttpError(response.status, response.statusText, await safeReadResponseText(response))
  return (await response.json()) as T
}

export function makeEvent(input: OutboundEventInput): OutboundEvent {
  return {
    _id: input._id ?? uuidv7(),
    sentDate: input.sentDate ?? new Date().toISOString(),
    ...input,
  } as OutboundEvent
}

export async function getSuggestions(
  config: OnboardingConfig,
  query: string,
  options: { limitQuestions?: number; limitKeywords?: number; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<SuggestionsResponseBody>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/suggestions`, {
      q: query,
      limit_questions: options.limitQuestions ?? 5,
      limit_keywords: options.limitKeywords ?? 0,
    }),
    { headers: authHeaders(config), signal: options.signal },
  )
}

export async function getProductById(
  config: OnboardingConfig,
  itemId: string,
  options: { limitQuestions?: number; includeVariants?: boolean; skipQuestionSelection?: boolean; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ item?: ProductDTO }>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/catalog/items/${encodeURIComponent(itemId)}`, {
      limitQuestions: options.limitQuestions,
      includeVariants: options.includeVariants,
      skipQuestionSelection: options.skipQuestionSelection,
    }),
    { headers: authHeaders(config), signal: options.signal },
  )
}

export async function getProductsById(
  config: OnboardingConfig,
  body: ProductRequestBody,
  options: { skipQuestionSelection?: boolean; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ items?: ProductDTO[] }>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/catalog/items`, { skipQuestionSelection: options.skipQuestionSelection }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
      body: JSON.stringify(body),
      signal: options.signal,
    },
  )
}

export async function getProductQuestionsById(
  config: OnboardingConfig,
  itemId: string,
  options: { limitQuestions?: number; skipQuestionSelection?: boolean; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ questions?: QuestionDTO[] }>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/catalog/items/${encodeURIComponent(itemId)}/questions`, {
      limitQuestions: options.limitQuestions,
      skipQuestionSelection: options.skipQuestionSelection,
    }),
    { headers: authHeaders(config), signal: options.signal },
  )
}

export async function getParentProduct(
  config: OnboardingConfig,
  productId: string,
  options: { limitQuestions?: number; includeVariants?: boolean; skipQuestionSelection?: boolean; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ parent_product?: ParentProductDTO }>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/catalog/parent_product/${encodeURIComponent(productId)}`, {
      limitQuestions: options.limitQuestions,
      includeVariants: options.includeVariants,
      skipQuestionSelection: options.skipQuestionSelection,
    }),
    { headers: authHeaders(config), signal: options.signal },
  )
}

export async function getParentProducts(
  config: OnboardingConfig,
  body: ParentProductRequestBody,
  options: { skipQuestionSelection?: boolean; signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ parent_products?: ParentProductDTO[] }>> {
  return fetchJson(
    withQuery(`${claritySearchBase(config)}/catalog/parent_products`, { skipQuestionSelection: options.skipQuestionSelection }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
      body: JSON.stringify(body),
      signal: options.signal,
    },
  )
}

export async function getPlpQuestions(
  config: OnboardingConfig,
  body: PlpRequestBody,
  options: { signal?: AbortSignal } = {},
): Promise<ClaritySearchResponse<{ plp?: { categories?: string[]; questions?: QuestionDTO[] } }>> {
  return fetchJson(`${claritySearchBase(config)}/catalog/plp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(config) },
    body: JSON.stringify(body),
    signal: options.signal,
  })
}

export async function getGeneralSettings(config: OnboardingConfig): Promise<GeneralSettings> {
  const cached = readJSON<CachedSettings>(LS.settings)
  const cacheMatches = cached?.agentId === config.agentId && typeof cached.cachedAt === 'number'

  if (cacheMatches && Date.now() - cached.cachedAt < SETTINGS_TTL_MS) {
    return cached.data
  }

  const url = `${trimTrailingSlash(config.apiUrl)}/ca/v1/agents/${encodeURIComponent(config.agentId)}/general-settings`

  try {
    // cache: 'no-store' so the browser never revalidates conditionally. A 304 has an empty
    // body and response.ok === false (ok is 200-299 only), so it would land in the catch
    // below and discard every setting - branding and translations included - rather than
    // reusing what we already had. This client does its own 6-hour localStorage caching, so
    // HTTP-level caching buys nothing here.
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', ...authHeaders(config) },
    })
    if (!response.ok) throw new Error(`general-settings failed with HTTP ${response.status}`)
    const data = (await response.json()) as GeneralSettings
    writeJSON(LS.settings, {
      cachedAt: Date.now(),
      agentId: config.agentId,
      data,
    } satisfies CachedSettings)
    return data
  } catch (error) {
    if (cacheMatches) {
      console.warn('general-settings fetch failed; using stale cache', error)
      return cached.data
    }
    throw error
  }
}

/**
 * One page of chat history, walking BACKWARDS from a cursor the client already holds.
 *
 * There is no first-page call: `after` is required, and the first cursor always comes from the
 * SYNC_EVENT_LOG.META event that opens a SYNC_EVENT_LOG response. A cursor this API did not
 * issue is a 400 rather than a silent restart at the newest page, so a client that lost its
 * cursor must re-sync instead of guessing one.
 *
 * Not retried and not streamed: it is a plain JSON GET, and a failed page is re-requested by
 * the shopper pressing load-more again.
 */
export async function getChatHistory(
  config: OnboardingConfig,
  chatId: string,
  after: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<ChatHistoryPage> {
  const base = `${trimTrailingSlash(config.apiUrl)}/ca/v1/agents/${encodeURIComponent(config.agentId)}`
  return fetchJson(
    withQuery(`${base}/chats/${encodeURIComponent(chatId)}/history`, { after, limit: options.limit }),
    { headers: authHeaders(config), signal: options.signal },
  )
}

export async function sendEventStream({
  config,
  chatId,
  endCustomerId,
  event,
  onEvent,
}: {
  config: OnboardingConfig
  chatId: string
  endCustomerId: string
  event: OutboundEvent
  onEvent: (event: unknown) => Promise<void> | void
}): Promise<void> {
  const abort = new AbortController()
  const timer = window.setTimeout(() => abort.abort('timeout'), REQUEST_TIMEOUT_MS)
  const endpoint = `${trimTrailingSlash(config.apiUrl)}/ca/v1/agents/${encodeURIComponent(config.agentId)}/chats/${encodeURIComponent(chatId)}/send-event`

  try {
    let lastHttpError: HttpError | null = null

    for (let attempt = 0; attempt <= SEND_EVENT_RETRY_ATTEMPTS; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(config) },
        body: JSON.stringify({
          event,
          url: window.location.href,
          localeTime: new Date().toISOString(),
          endCustomerId,
        }),
        signal: abort.signal,
      })

      if (response.ok) {
        if (!response.body) throw new Error('send-event response does not contain a stream body')
        let sawSyncMeta = false
        const stream = await jsonArrayStreamFetchReader(response, (item) => {
          if ((item as { type?: string } | null)?.type === 'SYNC_EVENT_LOG.META') sawSyncMeta = true
          return onEvent(item)
        })
        // A truncated turn that rendered something is left alone. One that rendered nothing has no
        // reply to keep, and a sync cut before SYNC_EVENT_LOG.META leaves paging state unset — which
        // hides Load earlier messages and passes a partial transcript off as a complete one. Both
        // need to reach the shopper so the turn can be retried.
        if (stream.truncated && (stream.dispatched === 0 || (event.type === 'SYNC_EVENT_LOG' && !sawSyncMeta))) {
          throw new Error('Stream truncated before the turn produced a usable result')
        }
        return
      }

      const responseText = await safeReadResponseText(response)
      const httpError = new HttpError(response.status, response.statusText, responseText)

      // Retry transient server failures. Do not retry 400-class client errors or 429 rate limiting.
      if (response.status >= 500 && attempt < SEND_EVENT_RETRY_ATTEMPTS) {
        lastHttpError = httpError
        await sleep(400 * 2 ** attempt)
        continue
      }

      throw httpError
    }

    if (lastHttpError) throw lastHttpError
  } catch (error) {
    if (abort.signal.aborted && abort.signal.reason === 'timeout') {
      throw new DOMException('Request timed out', 'AbortError')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

async function safeReadResponseText(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text()
    return text || undefined
  } catch {
    return undefined
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export interface StreamResult {
  events: unknown[]
  /** How many events reached onItem. Zero means the turn rendered nothing. */
  dispatched: number
  /** The body ended without its closing bracket. */
  truncated: boolean
}

export async function jsonArrayStreamFetchReader(
  response: Response,
  onItem: (item: unknown) => Promise<void> | void,
): Promise<StreamResult> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let lastIndex = -1
  let parsed: unknown[] = []
  let dispatched = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    try {
      parsed = JSON.parse(buffer) as unknown[]
    } catch {
      try {
        parsed = JSON.parse(`${buffer}]`) as unknown[]
      } catch {
        continue
      }
    }

    while (lastIndex + 1 < parsed.length) {
      dispatched += 1
      await onItem(parsed[++lastIndex])
    }
  }

  buffer += decoder.decode()
  // A complete turn is one whose final buffer parses as a whole JSON array. The last character
  // alone does not show that: a cut after `[{"data":[]` also ends in `]`.
  let complete = false
  try {
    const finalParse: unknown = JSON.parse(buffer)
    if (Array.isArray(finalParse)) {
      parsed = finalParse
      complete = true
    }
  } catch {
    // Keep the events the in-flight parse already produced.
  }

  while (lastIndex + 1 < parsed.length) {
    dispatched += 1
    await onItem(parsed[++lastIndex])
  }

  // Truncated turn. Every event parsed before the cut has already been handed to onItem and
  // rendered, so the caller keeps them; it decides whether what arrived is usable. See
  // documentation/01-how-the-chat-integration-works.md#parse-a-single-growing-array-incrementally.
  const truncated = !complete
  if (truncated) console.warn('Stream ended before the JSON array closed')

  return { events: parsed, dispatched, truncated }
}
