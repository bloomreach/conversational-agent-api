import { useLayoutEffect, useRef } from 'react'
import { renderMarkdown } from '../markdown'
import type { Currency, GeneralSettings, ProductItem, RenderMessage } from '../types'
import { formatPrice, pickFirstColor, safeProductUrl, translate } from '../utils'

interface Props {
  messages: RenderMessage[]
  progressText: string | null
  settings: GeneralSettings | null
  currency: Currency
  disabled: boolean
  onQuickReply: (reply: { label: string; target?: string | null; payload?: Record<string, unknown> | null }) => void
  /** Older history exists beyond the top of the thread — from SYNC_EVENT_LOG.META `hasMore`. */
  canLoadOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  /**
   * Bumped once per prepended history page. This is a SIGNAL, not a count: it is what tells the
   * scroll effect below that the thread grew upwards. Inferring that from the message list is
   * not reliable — closing an `appendOrphan` seam removes the message that was previously at
   * the top, so any check based on "is the old first message still present" reads a legitimate
   * prepend as an ordinary append and yanks the shopper to the newest message.
   */
  prependToken: number
  /** Retryable paging failure, shown next to the control that caused it rather than in the thread. */
  historyError: string | null
}

export function MessageList({
  messages,
  progressText,
  settings,
  currency,
  disabled,
  onQuickReply,
  canLoadOlder,
  loadingOlder,
  onLoadOlder,
  prependToken,
  historyError,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // Scroll position as it was before the latest render, so a prepended page can be corrected
  // for. scrollTop is captured on scroll rather than after each render because the shopper
  // moves it in between - reaching the top is how they ask for the previous page.
  const previous = useRef({ prependToken, scrollHeight: 0, scrollTop: 0 })

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    // A page of older history was inserted above the thread: hold the viewport on the message
    // the shopper was reading instead of yanking it to either end. Every other update - a new
    // reply, a streamed chunk - follows the thread to the newest message as before.
    const prepended = prependToken !== previous.current.prependToken

    node.scrollTop = prepended
      ? previous.current.scrollTop + (node.scrollHeight - previous.current.scrollHeight)
      : node.scrollHeight

    previous.current = { prependToken, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop }
  }, [messages, progressText, prependToken])

  const onScroll = () => {
    const node = ref.current
    if (node) previous.current.scrollTop = node.scrollTop
  }

  return (
    <main ref={ref} className="chat-messages" onScroll={onScroll}>
      {(canLoadOlder || historyError) && (
        <div className="history-loader">
          {canLoadOlder && (
            <button type="button" onClick={onLoadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}
          {/* Kept beside the control that failed. Appending it to the thread would scroll the
              shopper to the newest message, losing the position they were reading from - and
              no history was loaded, so there is nothing down there to see. */}
          {historyError && <div className="history-error">⚠ {historyError}</div>}
        </div>
      )}
      {messages.map((message) => {
        switch (message.kind) {
          case 'carousel':
            return <Carousel key={message.id} products={message.products} settings={settings} currency={currency} />
          case 'quickReply':
            return (
              <QuickReplies
                key={message.id}
                text={message.text}
                replies={message.replies}
                disabled={disabled}
                onQuickReply={onQuickReply}
              />
            )
          default:
            return (
              <div key={message.id} className={`message ${message.kind}${message.fatal ? ' fatal' : ''}`}>
                {message.kind === 'error' && (message.fatal ? '⛔ ' : '⚠ ')}
                {/* Only assistant text is markdown per the spec; user input and error copy
                    stay literal so nothing a shopper types is ever reinterpreted. */}
                {message.kind === 'assistant' ? renderMarkdown(message.text) : message.text}
              </div>
            )
        }
      })}
      {progressText && <div className="progress">{progressText}</div>}
    </main>
  )
}

function Carousel({ products, settings, currency }: { products: ProductItem[]; settings: GeneralSettings | null; currency: Currency }) {
  if (products.length === 0) {
    return <div className="carousel-empty">{translate(settings, 'noProductsFound', 'No products to show.')}</div>
  }

  return (
    <div className="carousel-wrap">
      <div className="carousel">
        {products.map((product, index) => (
          <ProductCard key={product.id || index} product={product} settings={settings} currency={currency} />
        ))}
      </div>
    </div>
  )
}

function ProductCard({ product, settings, currency }: { product: ProductItem; settings: GeneralSettings | null; currency: Currency }) {
  const color = pickFirstColor(product)
  const customizedAttrs = settings?.customerSettings?.customized_ui_attributes?.productCardAttrs ?? []
  const productUrl = safeProductUrl(product.url)

  return (
    <article className="carousel-card">
      {product.image && <img src={product.image} alt={product.title ?? ''} loading="lazy" />}
      {product.title && <div className="card-title">{product.title}</div>}
      <div className="card-meta">
        {product.price != null && <span className="card-price">{formatPrice(product.price, product.currency, currency)}</span>}
        {color && <span className="card-color">{color}</span>}
      </div>
      {customizedAttrs.length > 0 && product.extraVariantFields && (
        <dl className="card-attrs">
          {customizedAttrs.slice(0, 3).map((attr) => {
            const value = product.extraVariantFields?.[attr]
            if (value == null || value === '') return null
            return (
              <div key={attr}>
                <dt>{attr}</dt>
                <dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
              </div>
            )
          })}
        </dl>
      )}
      {productUrl && (
        <a className="card-link" href={productUrl} target="_blank" rel="noopener noreferrer">
          {translate(settings, 'view', 'View')}
        </a>
      )}
    </article>
  )
}

function QuickReplies({
  text,
  replies,
  disabled,
  onQuickReply,
}: {
  text?: string | null
  replies: { label: string; target?: string | null; payload?: Record<string, unknown> | null }[]
  disabled: boolean
  onQuickReply: (reply: { label: string; target?: string | null; payload?: Record<string, unknown> | null }) => void
}) {
  return (
    <div className="quick-reply-block">
      {text && <div className="message assistant">{text}</div>}
      <div className="quick-replies">
        {replies.map((reply) => (
          <button
            className="quick-reply-btn"
            key={reply.label}
            type="button"
            disabled={disabled}
            onClick={() => onQuickReply(reply)}
          >
            {reply.label}
          </button>
        ))}
      </div>
    </div>
  )
}
