import { useEffect, useState } from 'react'
import { useAuth } from '@/app/AuthContext'
import { auth as authApi } from '@/lib/services/api'
import { Button } from '@/components/Button'

type Step = 'phone' | 'code' | 'payment'
type PaymentMethod = 'cash' | 'card'

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
}

export function CheckoutModal({ onClose, onConfirm, submitting, submitError }: CheckoutModalProps) {
  const { user, login } = useAuth()

  // Always start at phone step — pre-fill if already authenticated
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState(() => user ? formatPhone(user.phone) : '')
  const [code, setCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')

  // If user signs in while modal is open (edge case), sync phone field
  useEffect(() => {
    if (user && !phone) setPhone(formatPhone(user.phone))
  }, [user, phone])

  useEffect(() => {
    if (step !== 'code' || resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [step, resendCooldown])

  async function sendCode() {
    const digits = getPhoneDigits(phone)
    if (digits.length < 10) {
      setPhoneError('Введите корректный номер телефона')
      return
    }
    setPhoneError('')
    setLoading(true)
    try {
      const response = await authApi.sendCode(digits)
      setGeneratedCode(response.code ?? '')
      setCode('')
      setStep('code')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (e: any) {
      setPhoneError(e.message ?? 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    if (code.length < 4) {
      setCodeError('Введите 4-значный код из SMS')
      return
    }
    setCodeError('')
    setLoading(true)
    try {
      await login(getPhoneDigits(phone), code)
      setStep('payment')
    } catch (e: any) {
      setCodeError(e.message ?? 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    if (step === 'code') {
      setStep('phone')
      setCode('')
      setCodeError('')
    } else {
      onClose()
    }
  }

  const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'cash', label: 'Наличные', icon: '💵' },
    { id: 'card', label: 'Банковская карта', icon: '💳' },
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
            onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center text-text-muted shrink-0"
            aria-label="Назад"
          >
            <ChevronLeftIcon />
          </button>
          <div>
            <h2 className="text-lg font-bold text-text-primary leading-tight">
              {step === 'phone' && 'Ваш номер телефона'}
              {step === 'code' && 'Введите код из SMS'}
              {step === 'payment' && 'Оформление заказа'}
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              {step === 'phone' && (user ? 'Подтвердите свой номер' : 'Мы отправим код подтверждения')}
              {step === 'code' && `Код отправлен на ${phone}`}
              {step === 'payment' && 'Выберите способ оплаты'}
            </p>
          </div>
        </div>

        <div className="px-4 pb-8 flex flex-col gap-5">
          {/* ── Phone step ── */}
          {step === 'phone' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">Телефон</label>
                <input
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value))
                    if (phoneError) setPhoneError('')
                  }}
                  autoFocus={!user}
                  readOnly={!!user}
                  className={[
                    'w-full h-12 rounded-btn border bg-white px-4',
                    'text-base font-medium text-text-primary placeholder:text-text-muted placeholder:font-normal',
                    'transition-colors outline-none',
                    user ? 'bg-gray-50 text-text-muted cursor-default' : '',
                    phoneError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-brand-muted focus:border-brand-orange',
                  ].join(' ')}
                />
                {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
              </div>

              {user ? (
                <Button onClick={() => setStep('payment')}>
                  Продолжить
                </Button>
              ) : (
                <Button onClick={sendCode} disabled={getPhoneDigits(phone).length < 10 || loading}>
                  {loading ? 'Отправка...' : 'Получить код'}
                </Button>
              )}
            </>
          )}

          {/* ── Code step ── */}
          {step === 'code' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">Код подтверждения</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="* * * *"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                    if (codeError) setCodeError('')
                  }}
                  autoFocus
                  className={[
                    'w-full h-14 rounded-btn border bg-white',
                    'text-3xl font-bold text-text-primary text-center tracking-[0.45em]',
                    'placeholder:text-text-muted placeholder:font-normal placeholder:tracking-[0.45em] placeholder:text-2xl',
                    'transition-colors outline-none px-4',
                    codeError
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-brand-muted focus:border-brand-orange',
                  ].join(' ')}
                />
                {codeError && <p className="text-sm text-red-500">{codeError}</p>}
              </div>

              {generatedCode && (
                <p className="text-xs text-text-muted text-center">
                  Ваш код: <span className="font-bold text-brand-orange">{generatedCode}</span>
                </p>
              )}

              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={sendCode}
                  disabled={loading || resendCooldown > 0}
                  className="text-sm text-text-muted text-center underline underline-offset-2 disabled:no-underline disabled:opacity-50"
                >
                  {loading
                    ? 'Отправляем новый код...'
                    : resendCooldown > 0
                      ? `Запросить новый код через ${formatCooldown(resendCooldown)}`
                      : 'Отправить код повторно'}
                </button>
              </div>

              <Button onClick={handleVerifyCode} disabled={code.length < 4 || loading}>
                {loading ? 'Проверка...' : 'Подтвердить'}
              </Button>
            </>
          )}

          {/* ── Payment step ── */}
          {step === 'payment' && (
            <>
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

              <Button onClick={onConfirm} disabled={submitting}>
                {submitting ? 'Оформление...' : 'Подтвердить заказ'}
              </Button>
              {submitError && <p className="text-xs text-red-500 text-center">{submitError}</p>}
            </>
          )}
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
