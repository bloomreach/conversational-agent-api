// Bloomreach Conversational Agent API helpers: request construction, settings cache, send-event streaming, and HTTP errors.
import { v7 as uuidv7 } from 'uuid'
import { LS, readJSON, writeJSON } from './storage'
import type {
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

// DOCUMENTATION.md now aligns the reference frontend cache with a 6-hour TTL.
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
    const response = await fetch(url, { headers: { Accept: 'application/json', ...authHeaders(config) } })
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
        await jsonArrayStreamFetchReader(response, onEvent)
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

export async function jsonArrayStreamFetchReader(
  response: Response,
  onItem: (item: unknown) => Promise<void> | void,
): Promise<unknown[]> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''
  let lastIndex = -1
  let parsed: unknown[] = []

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
      await onItem(parsed[++lastIndex])
    }
  }

  buffer += decoder.decode()
  try {
    parsed = JSON.parse(buffer) as unknown[]
  } catch {
    // The closing bracket check below reports malformed streams.
  }

  while (lastIndex + 1 < parsed.length) {
    await onItem(parsed[++lastIndex])
  }

  if (!buffer.trim().endsWith(']')) {
    throw new Error('Stream did not terminate with closing bracket')
  }

  return parsed
}
