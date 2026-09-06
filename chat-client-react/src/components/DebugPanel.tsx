import type { ChatEvent } from '../types'

interface Props {
  open: boolean
  events: ChatEvent[]
  onSimulateHttpError: (status: 400 | 429 | 500) => void
}

export function DebugPanel({ open, events, onSimulateHttpError }: Props) {
  return (
    <aside className={`debug-panel${open ? ' open' : ''}`}>
      <div className="debug-actions" aria-label="HTTP error simulation controls">
        <span>Simulate HTTP error:</span>
        <button type="button" onClick={() => onSimulateHttpError(400)}>
          400
        </button>
        <button type="button" onClick={() => onSimulateHttpError(429)}>
          429
        </button>
        <button type="button" onClick={() => onSimulateHttpError(500)}>
          500
        </button>
      </div>
      <pre>{events.map((event) => JSON.stringify(event)).join('\n')}</pre>
    </aside>
  )
}
