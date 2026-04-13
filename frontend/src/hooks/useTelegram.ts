/**
 * useTelegram — Telegram Mini App (TMA) integration hook.
 *
 * Returns the Telegram.WebApp object and derived helpers.
 * When running in a regular browser (no window.Telegram), `isTMA` is false
 * and all TMA-specific values are null — the app degrades gracefully.
 *
 * Usage:
 *   const { isTMA, tgUser, startParam, mainButton } = useTelegram()
 */

import { useEffect, useMemo } from 'react'

// ── Telegram WebApp type declarations ────────────────────────────────────────

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

export interface TelegramMainButton {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  setText(text: string): this
  onClick(callback: () => void): this
  offClick(callback: () => void): this
  show(): this
  hide(): this
  enable(): this
  disable(): this
  showProgress(leaveActive?: boolean): this
  hideProgress(): this
  setParams(params: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
  }): this
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
    query_id?: string
    auth_date?: number
    hash?: string
    chat_type?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: TelegramThemeParams
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  MainButton: TelegramMainButton
  ready(): void
  expand(): void
  close(): void
  onEvent(eventType: string, handler: () => void): void
  offEvent(eventType: string, handler: () => void): void
  sendData(data: string): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  isVersionAtLeast(version: string): boolean
  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void
}

// Augment the global Window interface
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'aparu_token'

export function useTelegram() {
  // Stable reference — Telegram.WebApp is set once before first render
  const tg = useMemo<TelegramWebApp | null>(() => window.Telegram?.WebApp ?? null, [])
  const isTMA = !!tg

  // Call ready() + expand() once on mount so the app fills the Telegram screen
  useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand()

    // Apply Telegram theme colour to the app container background
    const bg = tg.themeParams?.bg_color
    if (bg) tg.setBackgroundColor(bg)
  }, [tg])

  // Auto-login: exchange Telegram initData for a backend JWT on first load
  useEffect(() => {
    if (!tg || !tg.initData || !tg.initDataUnsafe.user) return
    if (localStorage.getItem(TOKEN_KEY)) return // already authenticated

    fetch('/api/v1/auth/tg-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: tg.initData }),
    })
      .then((r) => r.json())
      .then((data: { token?: string }) => {
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token)
      })
      .catch(() => {
        // Silent — user falls back to phone SMS flow
      })
  }, [tg])

  return {
    tg,
    isTMA,
    tgUser: tg?.initDataUnsafe?.user ?? null,
    startParam: tg?.initDataUnsafe?.start_param ?? null,
    themeParams: tg?.themeParams ?? null,
    colorScheme: tg?.colorScheme ?? ('light' as const),
    mainButton: tg?.MainButton ?? null,
    initData: tg?.initData ?? null,
  }
}
