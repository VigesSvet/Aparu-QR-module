import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { auth as authApi } from '@/lib/services/api'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

type Step = 'phone' | 'code'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [loading, setLoading] = useState(false)

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

  async function handleSendCode() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setPhoneError('Введите корректный номер телефона')
      return
    }
    setPhoneError('')
    setLoading(true)
    try {
      await authApi.sendCode(digits)
      setStep('code')
    } catch (e: any) {
      setPhoneError(e.message ?? 'Ошибка отправки кода')
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
      const digits = phone.replace(/\D/g, '')
      const res = await login(digits, code)
      // Route based on role
      switch (res.user.role) {
        case 'admin':
          navigate('/admin')
          break
        case 'driver':
          navigate('/driver')
          break
        default:
          navigate('/scan/1')
          break
      }
    } catch (e: any) {
      setCodeError(e.message ?? 'Неверный код')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      {/* Header */}
      <header className="flex flex-col items-center px-4 pt-12 pb-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-orange flex items-center justify-center mb-4 shadow-lg">
          <span className="text-white text-2xl font-bold">A</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">APARU</h1>
        <p className="text-sm text-text-muted mt-1">QR-сервис заказа такси</p>
      </header>

      <main className="flex flex-col flex-1 px-4 gap-6 pb-8">
        {step === 'phone' ? (
          <>
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-tight">Вход</h2>
              <p className="text-sm text-text-muted mt-1">Мы отправим код подтверждения на ваш номер</p>
            </div>

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

            <Button onClick={handleSendCode} disabled={phone.length < 3 || loading}>
              {loading ? 'Отправка...' : 'Получить код'}
            </Button>
          </>
        ) : (
          <>
            <div>
              <button
                onClick={() => { setStep('phone'); setCode(''); setCodeError('') }}
                className="text-sm text-text-muted mb-2 flex items-center gap-1"
              >
                <ChevronLeftIcon /> Назад
              </button>
              <h2 className="text-lg font-bold text-text-primary leading-tight">Введите код из SMS</h2>
              <p className="text-sm text-text-muted mt-1">
                Код отправлен на {phone}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Код подтверждения</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="1 2 3 4"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  if (codeError) setCodeError('')
                }}
                autoFocus
                className={[
                  'w-full h-14 rounded-btn border bg-white',
                  'text-3xl font-bold text-text-primary text-center tracking-[0.4em]',
                  'placeholder:text-text-muted placeholder:font-normal placeholder:tracking-[0.4em] placeholder:text-2xl',
                  'transition-colors outline-none',
                  codeError
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-brand-muted focus:border-brand-orange',
                ].join(' ')}
              />
              {codeError && <p className="text-sm text-red-500">{codeError}</p>}
            </div>

            <p className="text-xs text-text-muted text-center">
              Код для тестирования: <span className="font-bold text-brand-orange">1234</span>
            </p>

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
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
