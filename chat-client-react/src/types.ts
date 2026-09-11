export type Currency = 'GBP' | 'USD' | 'EUR' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'SEK' | 'NOK' | 'DKK' | string

export interface OnboardingConfig {
  apiUrl: string
  agentId: string
  apiToken: string
  currency: Currency
}

export interface MenuSettings {
  showGetHelp?: boolean | null
  getHelpLabel?: string | null
  getHelpLink?: string | null
  showLearnAboutClarity?: boolean | null
}

export interface CustomerSettings {
  category_attr_name_for_logging?: string | null
  use_text_notification?: boolean | null
  enable_agent_orchestrator?: boolean | null
  stock_attr_names?: string[] | null
  customized_ui_attributes?: {
    miniPDPAttrs?: string[] | null
    miniPDPTagAttrs?: string[] | null
    productCardAttrs?: string[] | null
    productCardTagAttrs?: string[] | null
  } | null
}

export interface GeneralSettings {
  assistantLogo?: string | null
  assistantName?: string | null
  agentPersonaName?: string | null
  description?: string | null
  translated: Record<string, string>
  menuSettings?: MenuSettings | null
  customerSettings?: CustomerSettings | null
  staticReplies: {
    notificationThinking?: string | null
  }
}

export type DirectCallTarget =
  | 'results_summarizer'
  | 'search_in_catalog'
  | 'sqr_with_search_or_extraction'
  | 'products_expert_question'
  | 'find_similar_or_compatible_products'
  | 'post_search'

export type DirectCallSource = 'DISCOVERY_SUGGESTION' | 'DISCOVERY_QR' | 'DISCOVERY' | 'DEFAULT' | 'WEBLAYER'

export interface QuestionDTO {
  identifier?: string | null
  question?: string | null
  answer?: string | null
  weight?: number | null
  topic?: string | null
  subtopic?: string | null
  mini_question?: string | null
}

export interface KeywordSuggestion {
  text?: string | null
  count?: number | null
}

export interface ProductDTO {
  pointId?: string | null
  itemId?: string | null
  _parsedPrice?: number | null
  __categories?: string[] | null
  _questions?: QuestionDTO[] | null
  _review?: { summary?: string | null; count?: number | null; averageRating?: number | null } | null
  data?: Record<string, unknown> | null
  _score?: number | null
  variants?: ProductDTO[] | null
}

export interface ParentProductDTO {
  pointId?: string | null
  product_id?: string | null
  item_ids?: string[] | null
  questions?: QuestionDTO[] | null
  variants?: ProductDTO[] | null
}

export interface ProductRequestBody {
  itemIds: string[]
  strict?: boolean
  includeVariants?: boolean
  limitVariants?: number
  limitQuestions?: number
  includeImplicitFilter?: boolean
  boost_config?: Record<string, unknown>
  fields?: string[]
}

export type NonEmptyStringArray = [string, ...string[]]

interface ParentProductRequestBodyBase {
  include_variants?: boolean
  fields_variants?: string[]
  include_implicit_filter_variants?: boolean
  filter_variants?: Record<string, unknown>
  user_context_filter_variants?: Record<string, unknown>
  limit_variants?: number
  limit_questions?: number
}

export type ParentProductRequestBody = ParentProductRequestBodyBase &
  (
    | { product_ids: NonEmptyStringArray; item_ids?: string[] }
    | { item_ids: NonEmptyStringArray; product_ids?: string[] }
  )

interface PlpRequestBodyBase {
  max_questions?: number
  plp_name?: string
  trace?: boolean
}

export type PlpRequestBody = PlpRequestBodyBase &
  (
    | { item_ids: NonEmptyStringArray; product_ids?: string[] }
    | { product_ids: NonEmptyStringArray; item_ids?: string[] }
  )

export interface ClaritySearchResponse<T> {
  message?: string
  response: T
}

export interface SuggestionsResponseBody {
  suggestions?: {
    questions?: QuestionDTO[]
    keywords?: KeywordSuggestion[]
  }
}

export interface ConversationStarter {
  text: string
  label: string
}

export interface ProductItem {
  id: string
  url?: string | null
  title?: string | null
  image?: string | null
  price?: number | string | null
  originalPrice?: number | string | null
  currency?: string | null
  description?: string | null
  variantAttributeList?: string[] | null
  questions?: { question: string; answer?: string | null; identifier?: string | null }[] | null
  variants?: Record<string, unknown>[] | null
  __categories?: string[] | null
  extraVariantFields?: Record<string, unknown> | null
  review?: { count?: number | null; averageRating?: number | null } | null
}

export interface EventEnvelope {
  _id: string
  type: string
  sentDate: string
  chatId?: string | null
  id?: string | null
}

export interface UserTextEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.USER.TEXT'
  text: string
}

export interface UserGenByButtonEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.USER.GEN_BY_BTN'
  text: 'SHOW_SIMILAR' | 'COMPARISON'
  label?: string | null
}

export interface UserDirectCallEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.USER.DIRECT_CALL'
  target?: DirectCallTarget | null
  source?: DirectCallSource | null
  text?: string | null
  invisible?: boolean | null
  payload?: Record<string, unknown> | null
}

export interface UserFeedbackEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.USER.FEEDBACK'
  score?: number | null
  text?: string | null
  messages?: string[] | null
}

export interface SyncEventLogEvent extends EventEnvelope {
  type: 'SYNC_EVENT_LOG'
  lastProcessedEventId?: string | null
  welcomeUnnecessary?: boolean | null
}

export type ContextRemovalKey = 'pageList' | 'pageProduct' | 'miniPageProduct' | 'shoppingCartList'

export interface SetContextEvent extends EventEnvelope {
  type: 'FE.SET_CONTEXT'
  currentItemIds?: string[] | null
  currentItemIdsType?: 'product_id' | 'item_id' | null
  currentItemId?: string | null
  cartItemIds?: string[] | null
  miniPageProduct?: string | null
  userContextFilter?: Record<string, unknown> | null
  currency?: string | null
  plpCategoryName?: string | null
  plpCategoryDescription?: string | null
  urlQueryParams?: string | null
  remove?: ContextRemovalKey[] | null
  uid?: string | null
}

export interface SelectedItemsEvent extends EventEnvelope {
  type: 'SELECTED_ITEMS'
  ids: string[]
  data?: ProductItem[] | null
  generatedFromAI?: boolean | null
  isSelectedFromLastBotResponse?: Record<string, boolean> | null
}

export interface PersistColdStartEvent extends EventEnvelope {
  type: 'PERSIST_COLD_START'
  events?: ChatEvent[] | null
}

export interface AssistantTextEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.ASSISTANT.TEXT' | 'ADD_MESSAGE.ASSISTANT.COLD_START' | 'APPEND_LAST_ASSISTANT_MESSAGE'
  text: string
  agent?: string | null
  marker?: string | null
  skipToneOfVoice?: boolean | null
  product_id_link_mapping?: string[] | null
}

export interface AssistantCarouselEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.ASSISTANT.CAROUSEL'
  data: ProductItem[]
  // Note: public carousels have no `hasMore` flag. The "see all results"
  // affordance is an optional, merchant-configured hand-off (not shown by
  // default) that can use `_metadata.queries` to open a storefront search page.
  categoryName?: string | null
  rephrasedQuery?: string | null
}

export interface AssistantQuickReplyEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.ASSISTANT.QUICK_REPLY'
  data: { label: string; target?: DirectCallTarget | null; payload?: Record<string, unknown> | null }[]
  text?: string | null
}

export interface AssistantNotificationEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.ASSISTANT.NOTIFICATION'
  toolName: string
  text: string
}

export interface UserCompareEvent extends EventEnvelope {
  type: 'ADD_MESSAGE.USER.COMPARE'
  ids: string[]
}

export interface MetadataSelectAgentEvent extends EventEnvelope {
  type: 'METADATA.SELECT_AGENT'
  agent: string
  conversationId: string
  userMessage: string
  [key: string]: unknown
}

export interface ErrorEvent extends EventEnvelope {
  type: 'ERROR' | 'FATAL_ERROR'
  text?: string | null
  exception?: unknown
  request?: unknown
}

export interface GenericEvent extends EventEnvelope {
  [key: string]: unknown
}

export type OutboundEvent =
  | UserTextEvent
  | UserGenByButtonEvent
  | UserDirectCallEvent
  | UserFeedbackEvent
  | SyncEventLogEvent
  | SetContextEvent
  | SelectedItemsEvent
  | PersistColdStartEvent
  | ErrorEvent
  | AssistantTextEvent

export type ChatEvent =
  | OutboundEvent
  | AssistantCarouselEvent
  | AssistantQuickReplyEvent
  | AssistantNotificationEvent
  | UserCompareEvent
  | MetadataSelectAgentEvent
  | GenericEvent

export type OutboundEventInput = OutboundEvent extends infer Event
  ? Event extends OutboundEvent
    ? Omit<Event, '_id' | 'sentDate'> & Partial<Pick<EventEnvelope, '_id' | 'sentDate'>>
    : never
  : never

export type RenderMessage =
  | { id: string; kind: 'user' | 'assistant' | 'system' | 'error'; text: string; fatal?: boolean; raw?: ChatEvent }
  | { id: string; kind: 'carousel'; products: ProductItem[]; raw: AssistantCarouselEvent }
  | { id: string; kind: 'quickReply'; text?: string | null; replies: AssistantQuickReplyEvent['data']; raw: AssistantQuickReplyEvent }
