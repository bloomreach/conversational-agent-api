import { v7 as uuidv7 } from 'uuid'
import type { ChatEvent, Currency, GeneralSettings, OnboardingConfig, ProductItem } from './types'

export const CURRENCY_OPTIONS = ['GBP', 'USD', 'EUR', 'JPY', 'AUD', 'CAD', 'CHF', 'SEK', 'NOK', 'DKK'] as const

export function uuid(): string {
  try {
    return uuidv7()
  } catch {
    return crypto.randomUUID()
  }
}

export function getEnvOnboarding(): OnboardingConfig | null {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  const agentId = import.meta.env.VITE_AGENT_ID as string | undefined
  const apiToken = import.meta.env.VITE_API_TOKEN as string | undefined
  const currency = (import.meta.env.VITE_CURRENCY as Currency | undefined) ?? 'GBP'

  if (!apiUrl || !agentId || !apiToken || apiUrl === 'https://example.com') return null
  return { apiUrl: apiUrl.replace(/\/+$/, ''), agentId, apiToken, currency }
}

export function validateOnboarding(config: OnboardingConfig): string | null {
  if (!config.apiUrl || !config.agentId || !config.apiToken || !config.currency) {
    return 'apiUrl, agentId, API token, and currency are required.'
  }
  try {
    new URL(config.apiUrl)
  } catch {
    return 'apiUrl must be a valid URL including protocol.'
  }
  return null
}

export function translate(settings: GeneralSettings | null, key: string, fallback: string): string {
  return settings?.translated?.[key] || fallback
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
}

export function formatPrice(price: ProductItem['price'], currency: string | null | undefined, fallbackCurrency: Currency): string {
  if (price == null || price === '') return ''
  const effective = String(currency || fallbackCurrency || '').toUpperCase()
  const symbol = effective ? CURRENCY_SYMBOLS[effective] ?? `${effective} ` : ''
  return `${symbol}${price}`
}

export function pickFirstColor(product: ProductItem): string | null {
  const value = product.extraVariantFields?.color
  if (Array.isArray(value) && value.length > 0) return String(value[0])
  if (typeof value === 'string' && value) return value
  return null
}

// Product URLs come from the catalog and are replayed out of stored history, so they are
// server data, not constants: a persisted `javascript:` or `data:` URL would otherwise become
// a clickable XSS payload the moment a shopper opens the card. Only http(s) is a product
// link; mailto: is allowed for markdown prose (see markdown.tsx) but never here.
const PRODUCT_ALLOWED_LINK_SCHEMES = ['http:', 'https:']

export function safeProductUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, window.location.href)
    return PRODUCT_ALLOWED_LINK_SCHEMES.includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}

export function userEventText(event: ChatEvent): string {
  const anyEvent = event as Record<string, unknown>
  if (typeof anyEvent.text === 'string' && anyEvent.text) return anyEvent.text
  if (typeof anyEvent.label === 'string' && anyEvent.label) return anyEvent.label
  if (Array.isArray(anyEvent.ids)) {
    const count = anyEvent.ids.length
    return `[selected ${count} item${count === 1 ? '' : 's'}]`
  }
  return '[user action]'
}

export function isUserVisibleUserEvent(type: string): boolean {
  return [
    'ADD_MESSAGE.USER.TEXT',
    'ADD_MESSAGE.USER.GEN_BY_BTN',
    'ADD_MESSAGE.USER.DIRECT_CALL',
    'ADD_MESSAGE.USER.COMPARE',
  ].includes(type)
}
