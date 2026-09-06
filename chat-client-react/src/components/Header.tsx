import type { GeneralSettings } from '../types'
import { translate } from '../utils'

interface Props {
  settings: GeneralSettings | null
  activeAgent: string | null
  onNewChat: () => void
  onToggleDebug: () => void
  onReset: () => void
}

export function Header({ settings, activeAgent, onNewChat, onToggleDebug, onReset }: Props) {
  const name = settings?.assistantName || settings?.agentPersonaName || 'Assistant'
  const initial = name.charAt(0).toUpperCase() || 'A'

  return (
    <header className="chat-header">
      {settings?.assistantLogo ? (
        <img className="avatar" src={settings.assistantLogo} alt="" />
      ) : (
        <div className="avatar-fallback" aria-hidden="true">
          {initial}
        </div>
      )}
      <div className="info">
        <div className="name">{name}</div>
        <div className="agent-badge">{activeAgent ? `agent: ${activeAgent}` : settings?.description}</div>
      </div>
      <div className="actions">
        {settings?.menuSettings?.showGetHelp && settings.menuSettings.getHelpLink && (
          <a className="header-link" href={settings.menuSettings.getHelpLink} target="_blank" rel="noreferrer">
            {settings.menuSettings.getHelpLabel || 'Help'}
          </a>
        )}
        <button type="button" onClick={onNewChat}>
          {translate(settings, 'clearChat', 'New chat')}
        </button>
        <button type="button" onClick={onToggleDebug}>
          {translate(settings, 'debugMode', 'Debug')}
        </button>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </header>
  )
}
