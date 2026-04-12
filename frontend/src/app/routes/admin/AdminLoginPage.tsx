import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { auth as authApi } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

type Step = 'phone' | 'code'

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

export function AdminLoginPage() {
  const navigate = useNavigate()
  const { login, user, isLoading } = useAuth()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // If already authenticated as admin — redirect immediately
  useEffect(() => {
    if (isLoading) return
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true })
    }
  }, [isLoading, user, navigate])

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
    setCodeError('')
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
      const digits = getPhoneDigits(phone)
      const res = await login(digits, code)
      if (res.user.role !== 'admin') {
        setCodeError('Нет прав доступа к админ-панели')
        return
      }
      navigate('/admin', { replace: true })
    } catch (e: any) {
      setCodeError(e.message ?? 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  function resetToPhoneStep() {
    setStep('phone')
    setCode('')
    setGeneratedCode('')
    setPhoneError('')
    setCodeError('')
    setResendCooldown(0)
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        {step === 'code' && (
          <button
            onClick={resetToPhoneStep}
            className="w-8 h-8 flex items-center justify-center text-text-muted"
            aria-label="Назад"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <div>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Вход в систему</p>
          <h1 className="text-lg font-bold text-text-primary leading-tight">
            {step === 'phone' ? 'Номер телефона' : 'Код подтверждения'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {step === 'phone'
              ? 'Введите номер администратора'
              : `Код отправлен на ${phone}`}
          </p>
        </div>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-6 pb-8">
        {step === 'phone' ? (
          <>
            <Input
              label="Телефон"
              type="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value))
                if (phoneError) setPhoneError('')
              }}
              error={phoneError}
              autoFocus
            />
            <div className="flex-1" />
            <Button onClick={sendCode} disabled={getPhoneDigits(phone).length < 10 || loading}>
              {loading ? 'Отправка...' : 'Получить код'}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Код из SMS</label>
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
                    ? `Повторно через ${formatCooldown(resendCooldown)}`
                    : 'Отправить код повторно'}
              </button>
            </div>

            <div className="flex-1" />
            <Button onClick={handleVerifyCode} disabled={code.length < 4 || loading}>
              {loading ? 'Проверка...' : 'Войти'}
            </Button>
          </>
        )}
      </main>
    </PageShell>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
