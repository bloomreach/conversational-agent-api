export const LS = {
  onboarding: 'clarityReact.onboarding',
  endCustomerId: 'clarityReact.endCustomerId',
  chatId: 'clarityReact.chatId',
  chatHistory: 'clarityReact.chatHistory',
  settings: 'clarityReact.settings',
} as const

export function readJSON<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function readOrCreate(key: string, factory: () => string): string {
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const value = factory()
  localStorage.setItem(key, value)
  return value
}
