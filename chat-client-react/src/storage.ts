export const LS = {
  onboarding: 'caReact.onboarding',
  endCustomerId: 'caReact.endCustomerId',
  chatId: 'caReact.chatId',
  chatHistory: 'caReact.chatHistory',
  settings: 'caReact.settings',
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
