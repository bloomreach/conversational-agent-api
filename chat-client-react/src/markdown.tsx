// Minimal markdown for ADD_MESSAGE.ASSISTANT.TEXT.
//
// Supports bold, italic, unordered/ordered lists and links — nothing else. It returns React
// nodes rather than an HTML string, so assistant text is only ever rendered as text and
// cannot become markup. Do not replace this with dangerouslySetInnerHTML: that turns a
// formatting helper into an XSS surface.
import type { ReactNode } from 'react'

const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:']
// ** first so bold wins over italic; a link's URL must be bracket- and space-free.
const INLINE = /\*\*([^*]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g
const UL_ITEM = /^\s*[*-]\s+(.*)$/
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href)
    return ALLOWED_LINK_SCHEMES.includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${match.index}`
    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{match[1]}</strong>)
    } else if (match[2] !== undefined || match[3] !== undefined) {
      nodes.push(<em key={key}>{match[2] !== undefined ? match[2] : match[3]}</em>)
    } else {
      const href = safeHref(match[5])
      if (href) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer">
            {match[4]}
          </a>,
        )
      } else {
        // Rejected scheme (javascript:, data:, ...) stays literal text.
        nodes.push(match[0])
      }
    }
    lastIndex = INLINE.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderMarkdown(source: string | null | undefined): ReactNode[] {
  const lines = String(source ?? '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const isUl = UL_ITEM.test(lines[i])
    const isOl = !isUl && OL_ITEM.test(lines[i])
    if (isUl || isOl) {
      const pattern = isUl ? UL_ITEM : OL_ITEM
      const items: ReactNode[] = []
      const start = i
      while (i < lines.length) {
        const item = pattern.exec(lines[i])
        if (!item) break
        items.push(<li key={`li-${i}`}>{renderInline(item[1], `li-${i}`)}</li>)
        i += 1
      }
      blocks.push(isUl ? <ul key={`ul-${start}`}>{items}</ul> : <ol key={`ol-${start}`}>{items}</ol>)
      continue
    }
    // Everything else is a text run. Newlines stay literal because .message already sets
    // white-space: pre-wrap; emitting <p> here would double the spacing.
    const run: string[] = []
    const start = i
    while (i < lines.length && !UL_ITEM.test(lines[i]) && !OL_ITEM.test(lines[i])) {
      run.push(lines[i])
      i += 1
    }
    blocks.push(<span key={`run-${start}`}>{renderInline(run.join('\n'), `run-${start}`)}</span>)
  }
  return blocks
}
