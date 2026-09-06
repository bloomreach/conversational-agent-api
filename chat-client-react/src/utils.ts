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
  const projectId = import.meta.env.VITE_PROJECT_ID as string | undefined
  const personaId = import.meta.env.VITE_PERSONA_ID as string | undefined
  const currency = (import.meta.env.VITE_CURRENCY as Currency | undefined) ?? 'GBP'

  if (!apiUrl || !projectId || !personaId || apiUrl === 'https://example.com') return null
  return { apiUrl: apiUrl.replace(/\/+$/, ''), projectId, personaId, currency }
}

export function validateOnboarding(config: OnboardingConfig): string | null {
  if (!config.apiUrl || !config.projectId || !config.personaId || !config.currency) {
    return 'apiUrl, projectId, personaId, and currency are required.'
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
