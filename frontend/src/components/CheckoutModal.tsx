import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/AuthContext'
import { auth as authApi } from '@/lib/services/api'
import { Button } from '@/components/Button'

type PhoneState = 'input' | 'code'
type PaymentMethod = 'cash' | 'card'
type Language = 'ru' | 'kk' | 'en'

const RESEND_COOLDOWN_SECONDS = 15

function getPhoneDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

function formatCooldown(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  let out = '+'
  if (digits.length <= 1) return out + digits
  out += digits[0] + ' ('
  if (digits.length <= 4) return out + digits.slice(1)
  out += digits.slice(1, 4) + ') '
  if (digits.length <= 7) return out + digits.slice(4)
  out += digits.slice(4, 7) + '-'
  if (digits.length <= 9) return out + digits.slice(7)
  out += digits.slice(7, 9) + '-' + digits.slice(9)
  return out
}

interface CheckoutModalProps {
  onClose: () => void
  onConfirm: () => Promise<void>
  submitting: boolean
  submitError: string
  language?: Language
}

const TEXT = {
  ru: {
    close: 'Закрыть',
    checkout: 'Оформление заказа',
    choosePayment: 'Выберите способ оплаты',
    cash: 'Наличные',
    card: 'Банковская карта',
    phone: 'Номер телефона',
    getCode: 'Получить код',
    changeNumber: 'Изменить номер',
    smsCode: 'Код из SMS на {{phone}}',
    change: 'Изменить',
    demoCode: 'Демо-код',
    sending: 'Отправляем...',
    resendAfter: 'Повторить через {{value}}',
    resend: 'Отправить код повторно',
    confirm: 'Подтвердить заказ',
    processing: 'Оформление...',
    invalidPhone: 'Введите корректный номер телефона',
    sendCodeError: 'Ошибка отправки кода',
    invalidCode: 'Введите 4-значный код',
    wrongCode: 'Неверный код',
  },
  kk: {
    close: 'Жабу',
    checkout: 'Тапсырысты рәсімдеу',
    choosePayment: 'Төлем тәсілін таңдаңыз',
    cash: 'Қолма-қол',
    card: 'Банк картасы',
    phone: 'Телефон нөмірі',
    getCode: 'Код алу',
    changeNumber: 'Нөмірді өзгерту',
    smsCode: 'SMS коды: {{phone}}',
    change: 'Өзгерту',
    demoCode: 'Демо-код',
    sending: 'Жіберілуде...',
    resendAfter: '{{value}} кейін қайталау',
    resend: 'Кодты қайта жіберу',
    confirm: 'Тапсырысты растау',
    processing: 'Рәсімделуде...',
    invalidPhone: 'Дұрыс телефон нөмірін енгізіңіз',
    sendCodeError: 'Код жіберу қатесі',
    invalidCode: '4 таңбалы кодты енгізіңіз',
    wrongCode: 'Код қате',
  },
  en: {
    close: 'Close',
    checkout: 'Complete your order',
    choosePayment: 'Choose a payment method',
    cash: 'Cash',
    card: 'Bank card',
    phone: 'Phone number',
    getCode: 'Get code',
    changeNumber: 'Change number',
    smsCode: 'SMS code sent to {{phone}}',
    change: 'Change',
    demoCode: 'Demo code',
    sending: 'Sending...',
    resendAfter: 'Resend in {{value}}',
    resend: 'Send code again',
    confirm: 'Confirm order',
    processing: 'Processing...',
    invalidPhone: 'Enter a valid phone number',
    sendCodeError: 'Failed to send code',
    invalidCode: 'Enter a 4-digit code',
    wrongCode: 'Incorrect code',
  },
} as const

function tr(language: Language, key: keyof typeof TEXT.ru, vars?: Record<string, string>) {
  let value: string = TEXT[language][key]
  if (!vars) return value
  for (const [name, part] of Object.entries(vars)) {
    value = value.split(`{{${name}}}`).join(part)
  }
  return value
}

export function CheckoutModal({ onClose, onConfirm, submitting, submitError, language = 'ru' }: CheckoutModalProps) {
  const { user, login } = useAuth()

  const [phone, setPhone] = useState(() => user ? formatPhone(user.phone) : '')
  const [phoneState, setPhoneState] = useState<PhoneState>('input')
  const [verified, setVerified] = useState(() => !!user)
  const [code, setCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  const codeInputRef = useRef<HTMLInputElement>(null)
  const isEditingPhone = useRef(false)

  // Sync phone when user authenticates while modal is open
  useEffect(() => {
    if (isEditingPhone.current) return
    if (user && !phone) setPhone(formatPhone(user.phone))
    if (user) setVerified(true)
  }, [user, phone])

  // Resend cooldown timer
  useEffect(() => {
    if (phoneState !== 'code' || resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { window.clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phoneState, resendCooldown])

  // Focus code input when switching to code state
  useEffect(() => {
    if (phoneState === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 50)
    }
  }, [phoneState])

  async function sendCode() {
    const digits = getPhoneDigits(phone)
    if (digits.length < 10) {
      setPhoneError(tr(language, 'invalidPhone'))
      return
    }
    setPhoneError('')
    setLoading(true)
    try {
      const response = await authApi.sendCode(digits)
      setGeneratedCode(response.code ?? '')
      setCode('')
      setCodeError('')
      setPhoneState('code')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (e: any) {
      setPhoneError(e.message ?? tr(language, 'sendCodeError'))
    } finally {
      setLoading(false)
    }
  }

  function resetPhone() {
    isEditingPhone.current = true
    setPhone('')
    setPhoneState('input')
    setCode('')
    setCodeError('')
    setGeneratedCode('')
    setVerified(false)
  }

  const phoneReady = getPhoneDigits(phone).length >= 10

  const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'cash', label: tr(language, 'cash'), icon: '💵' },
    { id: 'card', label: tr(language, 'card'), icon: '💳' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="relative w-full bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-2 pb-4">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-text-muted shrink-0"
            aria-label={tr(language, 'close')}
          >
            <ChevronLeftIcon />
          </button>
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">{tr(language, 'checkout')}</h2>
            <p className="text-sm text-text-muted mt-0.5">{tr(language, 'choosePayment')}</p>
          </div>
        </div>

        <div className="px-4 pb-8 flex flex-col gap-5">
          {/* Payment methods */}
          <div className="flex flex-col gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                  paymentMethod === method.id
                    ? 'border-brand-orange bg-surface-warm'
                    : 'border-gray-100 bg-white',
                ].join(' ')}
              >
                <span className="text-xl leading-none">{method.icon}</span>
                <span className="text-sm font-medium text-text-primary flex-1">{method.label}</span>
                {paymentMethod === method.id && <CheckIcon />}
              </button>
            ))}
          </div>

          {/* Phone / Code section */}
          <div className="flex flex-col gap-2">
            {phoneState === 'input' ? (
              <>
                <label className="text-sm font-medium text-text-primary">{tr(language, 'phone')}</label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                  <input
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatPhone(e.target.value))
                      if (phoneError) setPhoneError('')
                    }}
                    readOnly={verified && !!user}
                    className={[
                      'min-w-0 w-full h-12 rounded-btn border bg-white px-4',
                      'text-base font-medium text-text-primary placeholder:text-text-muted placeholder:font-normal',
                      'transition-colors outline-none',
                      verified && user ? 'bg-gray-50 text-text-muted cursor-default' : '',
                      phoneError
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-brand-muted focus:border-brand-orange',
                    ].join(' ')}
                  />
                  {!verified && (
                    <button
                      onClick={sendCode}
                      disabled={!phoneReady || loading}
                      className={[
                        'h-12 px-4 rounded-btn text-sm font-medium transition-colors shrink-0 whitespace-nowrap',
                        phoneReady && !loading
                          ? 'bg-brand-orange text-white'
                          : 'bg-gray-100 text-text-muted cursor-default',
                      ].join(' ')}
                    >
                      {loading ? '...' : tr(language, 'getCode')}
                    </button>
                  )}
                </div>
                {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                {verified && (
                  <button
                    onClick={resetPhone}
                    className="text-xs text-brand-orange underline underline-offset-2 self-start"
                  >
                    {tr(language, 'changeNumber')}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary">
                    {tr(language, 'smsCode', { phone })}
                  </label>
                  <button
                    onClick={resetPhone}
                    className="text-xs text-brand-orange underline underline-offset-2"
                  >
                    {tr(language, 'change')}
                  </button>
                </div>
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="· · · ·"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setCode(val)
                    if (codeError) setCodeError('')
                    if (val.length === 4) {
                      // auto-verify when 4 digits entered
                      setCodeError('')
                      setLoading(true)
                      login(getPhoneDigits(phone), val)
                        .then(() => { isEditingPhone.current = false; setVerified(true) })
                        .catch((err: any) => setCodeError(err.message ?? tr(language, 'wrongCode')))
                        .finally(() => setLoading(false))
                    }
                  }}
                  className={[
                    'w-full h-14 rounded-btn border bg-white',
                    'text-3xl font-bold text-text-primary text-center tracking-[0.45em]',
                    'placeholder:text-text-muted placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-2xl',
                    'transition-colors outline-none px-4',
                    codeError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-brand-muted focus:border-brand-orange',
                  ].join(' ')}
                />
                {codeError && <p className="text-sm text-red-500">{codeError}</p>}

                {generatedCode && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-warm border border-brand-muted">
                    <span className="text-xs text-text-muted">{tr(language, 'demoCode')}</span>
                    <span className="text-base font-bold tracking-[0.25em] text-brand-orange">{generatedCode}</span>
                  </div>
                )}

                <button
                  onClick={sendCode}
                  disabled={loading || resendCooldown > 0}
                  className="text-xs text-text-muted text-center underline underline-offset-2 disabled:no-underline disabled:opacity-50 self-center"
                >
                  {loading
                    ? tr(language, 'sending')
                    : resendCooldown > 0
                      ? tr(language, 'resendAfter', { value: formatCooldown(resendCooldown) })
                      : tr(language, 'resend')}
                </button>
              </>
            )}
          </div>

          <Button onClick={onConfirm} disabled={!verified || submitting}>
            {submitting ? tr(language, 'processing') : tr(language, 'confirm')}
          </Button>
          {submitError && <p className="text-xs text-red-500 text-center">{submitError}</p>}
        </div>
      </div>
    </div>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="text-brand-orange" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
