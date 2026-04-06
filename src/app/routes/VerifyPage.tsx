import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageShell } from '@/components/PageShell'

type Step = 'phone' | 'code'

export function VerifyPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')

  function handleSendCode() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setPhoneError('Введите корректный номер телефона')
      return
    }
    setPhoneError('')
    setStep('code')
  }

  function handleVerifyCode() {
    if (code.length < 4) {
      setCodeError('Введите 4-значный код из SMS')
      return
    }
    setCodeError('')
    navigate('/booking')
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

  return (
    <PageShell>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        {step === 'code' && (
          <button
            onClick={() => { setStep('phone'); setCode(''); setCodeError('') }}
            className="w-8 h-8 flex items-center justify-center text-text-muted"
            aria-label="Назад"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-text-primary leading-tight">
            {step === 'phone' ? 'Ваш номер телефона' : 'Введите код из SMS'}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {step === 'phone'
              ? 'Мы отправим код подтверждения'
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
            <Button onClick={handleSendCode} disabled={phone.length < 3}>
              Получить код
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">Код подтверждения</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="_ _ _ _"
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

            <button
              onClick={() => setStep('phone')}
              className="text-sm text-text-muted text-center underline underline-offset-2"
            >
              Отправить код повторно
            </button>

            <div className="flex-1" />
            <Button onClick={handleVerifyCode} disabled={code.length < 4}>
              Подтвердить
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
