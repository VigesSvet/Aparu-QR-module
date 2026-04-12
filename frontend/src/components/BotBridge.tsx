import { useEffect, useState } from 'react'

/**
 * BotBridge — sticky CTA banner that appears after the user selects a
 * taxi order or a tourism route, inviting them to follow updates in Telegram.
 *
 * Deep-link format:
 *   Taxi    → t.me/<BOT_USERNAME>?start=order_42
 *   Tourism → t.me/<BOT_USERNAME>?start=tour_altai-morning
 *
 * The bot username is read from the Vite env variable
 * VITE_TELEGRAM_BOT_USERNAME.  If that variable is not set the banner is
 * suppressed so the UI never shows a broken link.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BotBridgeContext = 'taxi' | 'tourism'

export interface BotBridgeProps {
  /** The deep-link start payload: "order_42" or "tour_altai-morning". */
  payload: string | null
  context: BotBridgeContext
  onDismiss: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined

function buildDeepLink(payload: string): string {
  const username = BOT_USERNAME ?? 'AparuVertexBot'
  return `https://t.me/${username}?start=${encodeURIComponent(payload)}`
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TelegramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-8 h-8 flex-shrink-0"
      aria-hidden="true"
    >
      {/* Telegram paper-plane */}
      <circle cx="12" cy="12" r="12" fill="currentColor" fillOpacity="0.12" />
      <path
        d="M5.06 11.6 18.1 6.37a.6.6 0 0 1 .79.77l-2.2 10.4a.6.6 0 0 1-.94.33l-3.4-2.47-1.64 1.58a.6.6 0 0 1-1.01-.3l-.72-3.05L5.06 12.4a.6.6 0 0 1 0-1.08 0 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Content by context ───────────────────────────────────────────────────────

const COPY: Record<BotBridgeContext, { heading: string; sub: string; cta: string }> = {
  taxi: {
    heading: 'Не теряйте связь',
    sub: 'Следите за машиной в Telegram — уведомление придёт, как только водитель будет на месте.',
    cta: 'Открыть трекер',
  },
  tourism: {
    heading: 'Не теряйте связь',
    sub: 'Сохраните свои билеты и маршрут в Telegram — всё будет под рукой.',
    cta: 'Открыть трекер',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BotBridge({ payload, context, onDismiss }: BotBridgeProps) {
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  // Mount → animate in
  useEffect(() => {
    if (payload) {
      setRendered(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [payload])

  function handleTransitionEnd() {
    if (!visible) setRendered(false)
  }

  function handleDismiss() {
    setVisible(false)
    // Let animation finish before propagating dismiss
    setTimeout(onDismiss, 300)
  }

  // Don't render if no payload or bot username is missing
  if (!rendered || !payload) return null

  const copy = COPY[context]
  const href = buildDeepLink(payload)

  return (
    <div
      className="transition-all duration-300 ease-out overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        maxHeight: visible ? '80px' : '0px',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Compact inline card for the "Важное" panel */}
      <div className="rounded-2xl bg-surface-base border border-brand-orange/30 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {/* Telegram icon — smaller */}
          <div className="text-brand-orange flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" aria-hidden="true">
              <circle cx="12" cy="12" r="12" fill="currentColor" fillOpacity="0.12" />
              <path
                d="M5.06 11.6 18.1 6.37a.6.6 0 0 1 .79.77l-2.2 10.4a.6.6 0 0 1-.94.33l-3.4-2.47-1.64 1.58a.6.6 0 0 1-1.01-.3l-.72-3.05L5.06 12.4a.6.6 0 0 1 0-1.08 0 0Z"
                fill="currentColor"
              />
            </svg>
          </div>

          {/* Text — single line */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary text-[13px] leading-tight truncate">
              {copy.heading}
            </p>
            <p className="text-text-muted text-[11px] leading-snug mt-0.5 line-clamp-1">
              {copy.sub}
            </p>
          </div>

          {/* CTA button — compact */}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 bg-brand-orange text-white font-bold text-[11px] px-3 py-1.5 rounded-lg active:scale-95 transition-transform hover:bg-orange-600"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.38 7.77 12.08 4.25a.4.4 0 0 1 .52.51L11.13 11.7a.4.4 0 0 1-.62.22L8 10.07l-1.09 1.05a.4.4 0 0 1-.67-.2l-.48-2.03-2.39-.78a.4.4 0 0 1 0-.72 0 0Z"
                fill="white"
              />
            </svg>
            {copy.cta}
          </a>

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-text-muted p-0.5 rounded-full hover:bg-surface-light transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
