import { useEffect, useRef, useState } from 'react'

// ─── Mock data ────────────────────────────────────────────────────────────────

interface TourRoute {
  id: string
  badge: string
  title: string
  description: string
  price: string
  // Gradient used for the image placeholder
  gradientFrom: string
  gradientTo: string
  // SVG scene identifier
  scene: 'mountain' | 'lake' | 'city' | 'forest'
}

interface Upsell {
  id: string
  icon: UpsellIcon
  title: string
  price: string
}

type UpsellIcon = 'museum' | 'camera' | 'food' | 'ticket' | 'guide'

const ROUTES: TourRoute[] = [
  {
    id: 'evening-city',
    badge: 'Топ выбор',
    title: 'Вечерний город',
    description: 'Ночная панорама Усть-Каменогорска: набережная, площадь Победы и подсвеченный мост.',
    price: '4 500 тг',
    gradientFrom: '#1a1a2e',
    gradientTo: '#16213e',
    scene: 'city',
  },
  {
    id: 'altai-morning',
    badge: '3 часа',
    title: 'Алтайское утро',
    description: 'Горные дороги с видом на хребет Ивановский и живописные предгорья.',
    price: '7 200 тг',
    gradientFrom: '#2d6a4f',
    gradientTo: '#40916c',
    scene: 'mountain',
  },
  {
    id: 'lake-ulken',
    badge: 'Природа',
    title: 'Озеро Ульби',
    description: 'Тихий берег в 40 км от города. Рыбалка, пикник и закат над водой.',
    price: '5 800 тг',
    gradientFrom: '#023e8a',
    gradientTo: '#0096c7',
    scene: 'lake',
  },
  {
    id: 'cedar-valley',
    badge: '5 часов',
    title: 'Кедровая долина',
    description: 'Кедровый лес и горная речка. Маршрут для тех, кто хочет выдохнуть.',
    price: '6 500 тг',
    gradientFrom: '#344e41',
    gradientTo: '#588157',
    scene: 'forest',
  },
]

const UPSELLS: Upsell[] = [
  { id: 'museum',  icon: 'museum',  title: 'Билет в музей',    price: '+600 тг' },
  { id: 'camera',  icon: 'camera',  title: 'Фотосессия',       price: '+1 200 тг' },
  { id: 'food',    icon: 'food',    title: 'Дегустация',       price: '+900 тг' },
  { id: 'ticket',  icon: 'ticket',  title: 'Входной билет',    price: '+400 тг' },
  { id: 'guide',   icon: 'guide',   title: 'Аудиогид',         price: '+300 тг' },
]

// ─── Scene SVG placeholders ───────────────────────────────────────────────────

function SceneSvg({ scene }: { scene: TourRoute['scene'] }) {
  if (scene === 'city') {
    return (
      <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect width="320" height="140" fill="url(#cityGrad)" />
        <defs>
          <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#16213e" />
          </linearGradient>
        </defs>
        {/* Stars */}
        {[[20,18],[50,10],[90,22],[140,8],[190,14],[240,20],[290,12],[310,28],[60,35],[170,30]].map(([x,y], i) => (
          <circle key={i} cx={x} cy={y} r="1.2" fill="white" fillOpacity="0.7" />
        ))}
        {/* Moon */}
        <circle cx="270" cy="28" r="12" fill="#ffd166" fillOpacity="0.9" />
        <circle cx="277" cy="24" r="10" fill="#16213e" />
        {/* Buildings */}
        <rect x="10"  y="70" width="30" height="70" fill="#0f3460" />
        <rect x="15"  y="60" width="20" height="15" fill="#0f3460" />
        <rect x="45"  y="50" width="40" height="90" fill="#162447" />
        <rect x="52"  y="40" width="26" height="16" fill="#162447" />
        <rect x="90"  y="65" width="28" height="75" fill="#0f3460" />
        <rect x="123" y="45" width="50" height="95" fill="#1f4068" />
        <rect x="130" y="36" width="36" height="14" fill="#1f4068" />
        <rect x="178" y="55" width="36" height="85" fill="#162447" />
        <rect x="219" y="70" width="28" height="70" fill="#0f3460" />
        <rect x="252" y="58" width="44" height="82" fill="#1a1a2e" />
        <rect x="301" y="72" width="20" height="68" fill="#0f3460" />
        {/* Windows */}
        {[[50,55],[60,55],[50,70],[60,70],[50,85],[60,85],[130,50],[148,50],[130,65],[148,65],[183,65],[200,65],[183,80],[200,80]].map(([x,y], i) => (
          <rect key={i} x={x} y={y} width="7" height="5" fill="#ffd166" fillOpacity="0.6" rx="1" />
        ))}
        {/* Bridge */}
        <path d="M60 115 Q160 95 260 115" stroke="#4cc9f0" strokeWidth="2.5" fill="none" strokeOpacity="0.8" />
        <line x1="60" y1="115" x2="60" y2="130" stroke="#4cc9f0" strokeWidth="2" strokeOpacity="0.5" />
        <line x1="260" y1="115" x2="260" y2="130" stroke="#4cc9f0" strokeWidth="2" strokeOpacity="0.5" />
        {/* River reflection */}
        <rect x="0" y="128" width="320" height="12" fill="#4cc9f0" fillOpacity="0.12" />
      </svg>
    )
  }
  if (scene === 'mountain') {
    return (
      <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#74b9ff" />
            <stop offset="100%" stopColor="#dfe6e9" />
          </linearGradient>
          <linearGradient id="mtnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#636e72" />
            <stop offset="100%" stopColor="#2d3436" />
          </linearGradient>
        </defs>
        <rect width="320" height="140" fill="url(#skyGrad)" />
        {/* Sun */}
        <circle cx="260" cy="32" r="22" fill="#fdcb6e" fillOpacity="0.85" />
        {/* Background mountains */}
        <polygon points="0,140 80,55 160,140" fill="#b2bec3" fillOpacity="0.6" />
        <polygon points="80,140 200,40 320,140" fill="#636e72" fillOpacity="0.5" />
        {/* Main mountain */}
        <polygon points="40,140 160,20 280,140" fill="url(#mtnGrad)" />
        {/* Snow cap */}
        <polygon points="140,36 160,20 180,36 165,45 155,45" fill="white" fillOpacity="0.9" />
        {/* Foreground hills */}
        <ellipse cx="50" cy="140" rx="120" ry="35" fill="#55a630" />
        <ellipse cx="270" cy="140" rx="100" ry="30" fill="#70e000" fillOpacity="0.7" />
        {/* Road */}
        <path d="M140,140 Q160,110 175,90" stroke="#dfe6e9" strokeWidth="3" strokeOpacity="0.6" strokeDasharray="6 4" />
      </svg>
    )
  }
  if (scene === 'lake') {
    return (
      <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="skyL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0096c7" />
            <stop offset="100%" stopColor="#90e0ef" />
          </linearGradient>
          <linearGradient id="waterL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#48cae4" />
            <stop offset="100%" stopColor="#023e8a" />
          </linearGradient>
        </defs>
        <rect width="320" height="140" fill="url(#skyL)" />
        {/* Clouds */}
        <ellipse cx="80" cy="28" rx="38" ry="14" fill="white" fillOpacity="0.8" />
        <ellipse cx="60" cy="32" rx="26" ry="12" fill="white" fillOpacity="0.7" />
        <ellipse cx="230" cy="22" rx="32" ry="12" fill="white" fillOpacity="0.75" />
        {/* Hills */}
        <ellipse cx="0"   cy="95" rx="90" ry="40" fill="#52b788" />
        <ellipse cx="320" cy="95" rx="90" ry="40" fill="#52b788" />
        {/* Water */}
        <ellipse cx="160" cy="130" rx="145" ry="40" fill="url(#waterL)" />
        {/* Reflections */}
        <line x1="130" y1="110" x2="128" y2="140" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
        <line x1="160" y1="105" x2="158" y2="140" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
        <line x1="190" y1="110" x2="188" y2="140" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
        {/* Boat */}
        <path d="M148,118 Q160,113 172,118 L170,124 L150,124 Z" fill="white" fillOpacity="0.9" />
        <line x1="160" y1="114" x2="160" y2="104" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        <polygon points="160,104 172,110 160,114" fill="#ff6b6b" fillOpacity="0.8" />
      </svg>
    )
  }
  // forest
  return (
    <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="skyF" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b7e4c7" />
          <stop offset="100%" stopColor="#d8f3dc" />
        </linearGradient>
      </defs>
      <rect width="320" height="140" fill="url(#skyF)" />
      {/* Background trees */}
      {[20,60,100,140,180,220,260,300].map((x, i) => (
        <g key={i} transform={`translate(${x}, 40)`}>
          <polygon points="-12,50 0,5 12,50" fill="#52b788" fillOpacity="0.5" />
        </g>
      ))}
      {/* Mid trees */}
      {[0,50,110,170,230,290].map((x, i) => (
        <g key={i} transform={`translate(${x}, 55)`}>
          <rect x="-3" y="30" width="6" height="20" fill="#6b4226" fillOpacity="0.7" />
          <polygon points="-16,35 0,0 16,35" fill="#40916c" fillOpacity="0.8" />
          <polygon points="-12,22 0,-10 12,22" fill="#52b788" fillOpacity="0.9" />
        </g>
      ))}
      {/* Ground */}
      <rect x="0" y="110" width="320" height="30" fill="#344e41" />
      {/* Path */}
      <path d="M130,140 Q155,115 160,100 Q165,115 190,140" fill="#6b4226" fillOpacity="0.5" />
      {/* Creek */}
      <path d="M0,125 Q80,118 160,122 Q240,126 320,120" stroke="#90e0ef" strokeWidth="3" fill="none" strokeOpacity="0.7" />
    </svg>
  )
}

// ─── Upsell icon SVGs ─────────────────────────────────────────────────────────

function UpsellIconSvg({ icon }: { icon: UpsellIcon }) {
  const cls = 'w-7 h-7'
  if (icon === 'museum') return (
    <svg className={cls} viewBox="0 0 28 28" fill="none"><path d="M4 22h20M4 22v-2h20v2M6 10v10M11 10v10M17 10v10M22 10v10M3 10h22M14 4l11 6H3l11-6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  )
  if (icon === 'camera') return (
    <svg className={cls} viewBox="0 0 28 28" fill="none"><rect x="3" y="9" width="22" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><circle cx="14" cy="16.5" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9l1.5-3h5L18 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="21" cy="12" r="1" fill="currentColor" /></svg>
  )
  if (icon === 'food') return (
    <svg className={cls} viewBox="0 0 28 28" fill="none"><path d="M9 4v8a4 4 0 004 4v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M5 4v4a4 4 0 008 0V4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M19 4c0 0 4 3 4 8s-4 4-4 4v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  )
  if (icon === 'ticket') return (
    <svg className={cls} viewBox="0 0 28 28" fill="none"><path d="M3 10a2 2 0 010-4h22a2 2 0 010 4v1a2 2 0 010 4v1a2 2 0 010 4H3a2 2 0 010-4v-1a2 2 0 010-4v-1z" stroke="currentColor" strokeWidth="1.6" /><line x1="10" y1="6" x2="10" y2="22" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" /></svg>
  )
  // guide
  return (
    <svg className={cls} viewBox="0 0 28 28" fill="none"><circle cx="14" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M6 24c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M14 16v4l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  )
}

// ─── Route card ───────────────────────────────────────────────────────────────

function RouteCard({
  route,
  selected,
  loading,
  onSelect,
}: {
  route: TourRoute
  selected: boolean
  loading: boolean
  onSelect: () => void
}) {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface-base shadow-sm flex flex-col">
      {/* Image area */}
      <div className="relative h-36 w-full overflow-hidden">
        <SceneSvg scene={route.scene} />
        {/* Badge */}
        <div className="absolute top-3 left-3 bg-white text-text-primary text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
          {route.badge}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <p className="font-bold text-text-primary text-[15px] leading-snug">{route.title}</p>
        <p className="text-text-muted text-[13px] leading-relaxed line-clamp-2">{route.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-text-primary font-bold text-[17px]">{route.price}</span>
          <button
            type="button"
            onClick={onSelect}
            disabled={loading}
            className={[
              'px-4 py-1.5 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95 min-w-[88px] flex items-center justify-center gap-1.5',
              selected
                ? 'bg-surface-base border-2 border-brand-orange text-brand-orange'
                : 'bg-brand-orange text-white hover:bg-orange-600',
            ].join(' ')}
          >
            {loading ? (
              <SpinnerIcon />
            ) : selected ? (
              <>
                <CheckIcon />
                Выбрано
              </>
            ) : (
              'Выбрать'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upsell mini-card ─────────────────────────────────────────────────────────

function UpsellCard({ item }: { item: Upsell }) {
  const [picked, setPicked] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setPicked(p => !p)}
      className={[
        'flex-shrink-0 w-28 rounded-2xl p-3 flex flex-col items-center gap-2 transition-all duration-200 active:scale-95',
        picked
          ? 'bg-surface-warm border-2 border-brand-orange'
          : 'bg-surface-base border-2 border-transparent',
      ].join(' ')}
    >
      <div className="text-brand-orange">
        <UpsellIconSvg icon={item.icon} />
      </div>
      <p className="text-text-primary text-[12px] font-semibold text-center leading-tight">{item.title}</p>
      <p className="text-brand-orange text-[11px] font-bold">{item.price}</p>
    </button>
  )
}

// ─── Inline icons ─────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TourismBottomSheetProps {
  open: boolean
  onClose: () => void
  /** Called with the route ID after the user confirms selection */
  onRouteSelect?: (routeId: string) => void
}

export function TourismBottomSheet({ open, onClose, onRouteSelect }: TourismBottomSheetProps) {
  // "rendered" controls whether the DOM node exists at all; "visible" drives the CSS transform
  const [rendered, setRendered] = useState(false)
  const [visible, setVisible] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  // open → mount then animate in
  useEffect(() => {
    if (open) {
      setRendered(true)
      // give browser one frame to paint before triggering transition
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // After slide-down finishes, unmount
  function handleTransitionEnd() {
    if (!visible) setRendered(false)
  }

  // Scroll body lock while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleSelect(id: string) {
    if (loadingId || selectedId === id) return
    setLoadingId(id)
    await new Promise<void>(res => setTimeout(res, 900))
    setLoadingId(null)
    setSelectedId(id)
    onRouteSelect?.(id)
  }

  if (!rendered) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      >
        <div
          className="w-full max-w-mobile pointer-events-auto bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.18)] transition-transform duration-350 ease-out flex flex-col"
          style={{
            maxHeight: '88vh',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transitionDuration: visible ? '360ms' : '280ms',
            transitionTimingFunction: visible ? 'cubic-bezier(0.32,0.72,0,1)' : 'cubic-bezier(0.4,0,1,1)',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-text-muted/30" />
          </div>

          {/* Sticky header */}
          <div className="sticky top-0 bg-white z-10 px-5 pt-2 pb-3 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-text-primary leading-tight">Куда отправимся?</h2>
                <p className="text-[13px] text-text-muted mt-0.5">Готовые маршруты с фиксированной ценой</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-0.5 p-1.5 rounded-full text-text-muted hover:bg-surface-base transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div
            ref={scrollRef}
            className="overflow-y-auto flex-1 px-4 pb-8"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Routes section */}
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
              Популярные маршруты
            </p>
            <div className="flex flex-col gap-4">
              {ROUTES.map(route => (
                <RouteCard
                  key={route.id}
                  route={route}
                  selected={selectedId === route.id}
                  loading={loadingId === route.id}
                  onSelect={() => handleSelect(route.id)}
                />
              ))}
            </div>

            {/* Upsell section */}
            <p className="text-[15px] font-semibold text-text-primary mt-7 mb-3">Добавить к поездке</p>
            <div
              className="flex gap-3 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {UPSELLS.map(item => (
                <UpsellCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
