import { FormEvent, KeyboardEvent, useState } from 'react'
import type { ConversationStarter, GeneralSettings } from '../types'
import { translate } from '../utils'

interface Props {
  settings: GeneralSettings | null
  disabled: boolean
  starters?: ConversationStarter[]
  startersHeading?: string
  onTextChange?: (text: string) => void
  onStarterClick?: (starter: ConversationStarter) => void
  onSubmit: (text: string) => void
}

export function Composer({ settings, disabled, starters = [], startersHeading = 'Conversation starters', onTextChange, onStarterClick, onSubmit }: Props) {
  const [text, setText] = useState('')

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    setText('')
    onTextChange?.('')
    onSubmit(trimmed)
  }

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const clickStarter = (starter: ConversationStarter) => {
    if (disabled) return
    setText('')
    onTextChange?.('')
    onStarterClick?.(starter)
  }

  return (
    <div className="composer-area">
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={translate(settings, 'inputPlaceholder', 'Type a message…')}
          onChange={(event) => {
            setText(event.target.value)
            onTextChange?.(event.target.value)
          }}
          onKeyDown={keyDown}
        />
        <button type="submit" disabled={disabled || !text.trim()}>
          {translate(settings, 'submit', 'Send')}
        </button>
      </form>
      {starters.length > 0 && (
        <div className="conversation-starters" aria-label="Conversation starter suggestions">
          <div className="conversation-starters-label">{startersHeading}</div>
          {starters.map((starter) => (
            <button
              key={`${starter.label}:${starter.text}`}
              type="button"
              className="suggestion-btn"
              title={starter.text}
              disabled={disabled}
              onClick={() => clickStarter(starter)}
            >
              {starter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
