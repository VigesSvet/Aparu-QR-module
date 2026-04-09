import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageShell } from '@/components/PageShell'
import { getRepeatScanPath } from '@/lib/scanContext'

export function DonePage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <main className="flex flex-col flex-1 px-4 pt-10 pb-8 items-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-surface-warm flex items-center justify-center text-4xl mb-6">
          ✅
        </div>

        <h1 className="text-2xl font-bold text-text-primary text-center leading-tight">
          Поездка завершена
        </h1>
        <p className="text-base text-text-muted text-center mt-2">
          Спасибо, что воспользовались APARU
        </p>

        {/* Rating */}
        <div className="w-full mt-8">
          <Card warm>
            <p className="text-sm text-text-muted text-center mb-3">Оцените поездку</p>
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className="text-3xl text-gray-200 hover:text-brand-orange transition-colors active:scale-110"
                  aria-label={`${star} звезда`}
                >
                  ★
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex-1" />

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full mt-8">
          <Button
            variant="main"
            onClick={() => {
              window.open('https://aparu.kz', '_blank', 'noopener,noreferrer')
            }}
          >
            Установить приложение APARU
          </Button>
          <Button
            variant="third"
            onClick={() => navigate(getRepeatScanPath())}
          >
            Заказать ещё раз
          </Button>
        </div>
      </main>
    </PageShell>
  )
}
