import { useEffect, useRef } from 'react'
import { renderMarkdown } from '../markdown'
import type { Currency, GeneralSettings, ProductItem, RenderMessage } from '../types'
import { formatPrice, pickFirstColor, translate } from '../utils'

interface Props {
  messages: RenderMessage[]
  progressText: string | null
  settings: GeneralSettings | null
  currency: Currency
  disabled: boolean
  onQuickReply: (reply: { label: string; target?: string | null; payload?: Record<string, unknown> | null }) => void
}

export function MessageList({ messages, progressText, settings, currency, disabled, onQuickReply }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, progressText])

  return (
    <main ref={ref} className="chat-messages">
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
      {product.url && (
        <a className="card-link" href={product.url} target="_blank" rel="noopener noreferrer">
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
