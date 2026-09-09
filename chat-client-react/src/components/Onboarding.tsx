import { FormEvent, useState } from 'react'
import type { OnboardingConfig } from '../types'
import { CURRENCY_OPTIONS, validateOnboarding } from '../utils'

interface Props {
  initialConfig: OnboardingConfig | null
  initialEndCustomerId: string
  error?: string | null
  onSubmit: (config: OnboardingConfig, endCustomerId: string) => void
}

export function Onboarding({ initialConfig, initialEndCustomerId, error, onSubmit }: Props) {
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl ?? '')
  const [agentId, setAgentId] = useState(initialConfig?.agentId ?? '')
  const [apiToken, setApiToken] = useState(initialConfig?.apiToken ?? '')
  const [currency, setCurrency] = useState(initialConfig?.currency ?? 'GBP')
  const [endCustomerId, setEndCustomerId] = useState(initialEndCustomerId)
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const config = {
      apiUrl: apiUrl.trim().replace(/\/+$/, ''),
      agentId: agentId.trim(),
      apiToken: apiToken.trim(),
      currency: currency.trim(),
    }
    const validationError = validateOnboarding(config)
    if (validationError) {
      setLocalError(validationError)
      return
    }
    setLocalError(null)
    onSubmit(config, endCustomerId.trim())
  }

  return (
    <main className="screen onboarding active">
      <form className="onboarding-form" onSubmit={submit}>
        <h1>Bloomreach Conversational Agent API — React + Vite Test Client</h1>
        <p className="hint">Enter the onboarding details provided by Bloomreach.</p>
        {(localError || error) && <div className="error shown">{localError || error}</div>}

        <label>
          apiUrl
          <input
            type="url"
            required
            value={apiUrl}
            placeholder="https://api.example.com"
            autoComplete="off"
            onChange={(event) => setApiUrl(event.target.value)}
          />
        </label>

        <label>
          agentId
          <input required value={agentId} autoComplete="off" onChange={(event) => setAgentId(event.target.value)} />
        </label>

        <label>
          API token
          <input type="password" required value={apiToken} autoComplete="off" onChange={(event) => setApiToken(event.target.value)} />
        </label>

        <label>
          currency
          <select required value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="field-note">used for price formatting and passed via FE.SET_CONTEXT</span>
        </label>

        <label>
          endCustomerId <span className="field-note">(optional — auto-generated if blank)</span>
          <input value={endCustomerId} autoComplete="off" onChange={(event) => setEndCustomerId(event.target.value)} />
        </label>

        <button type="submit">Start chat</button>
      </form>
    </main>
  )
}
