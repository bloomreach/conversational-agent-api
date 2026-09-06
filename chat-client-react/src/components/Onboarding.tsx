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
  const [projectId, setProjectId] = useState(initialConfig?.projectId ?? '')
  const [personaId, setPersonaId] = useState(initialConfig?.personaId ?? '')
  const [currency, setCurrency] = useState(initialConfig?.currency ?? 'GBP')
  const [endCustomerId, setEndCustomerId] = useState(initialEndCustomerId)
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const config = {
      apiUrl: apiUrl.trim().replace(/\/+$/, ''),
      projectId: projectId.trim(),
      personaId: personaId.trim(),
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
        <h1>Conversational Agent Chat — React Test Client</h1>
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
          projectId
          <input required value={projectId} autoComplete="off" onChange={(event) => setProjectId(event.target.value)} />
        </label>

        <label>
          personaId
          <input required value={personaId} autoComplete="off" onChange={(event) => setPersonaId(event.target.value)} />
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
