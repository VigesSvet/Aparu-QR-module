import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { RouteMap } from '../../components/ride/RouteMap';
import { createMockOrder, getNextStatus, hydrateOrderStatus } from '../../lib/order';
import { requestSmsCode, verifySmsCode } from '../../lib/sms';
import { buildRoute, geocode, reverseGeocode } from '../../lib/services/aparu-maps';
import { codeIsValid, formatDistance, formatMinutes, formatPhoneInput, phoneIsValid } from '../../lib/utils/format';
import { parseRideQuery } from '../../lib/utils/ride-query';
import type { PaymentMethod, RideDraft, RideOrder, RidePoint, RideStage, RideStatus, Tariff } from '../../types/ride';

const TARIFFS: { id: Tariff; title: string; subtitle: string; multiplier: string }[] = [
  { id: 'economy', title: 'Economy', subtitle: 'Быстро и без лишнего', multiplier: 'от 890 ₸' },
  { id: 'comfort', title: 'Comfort', subtitle: 'Больше пространства', multiplier: 'от 1 250 ₸' },
  { id: 'business', title: 'Business', subtitle: 'Для деловых поездок', multiplier: 'от 1 690 ₸' },
];

const STATUS_META: Record<RideStatus, { title: string; text: string }> = {
  searching: { title: 'Ищем водителя', text: 'Смотрим ближайшие машины рядом с вами.' },
  driver_assigned: { title: 'Водитель найден', text: 'Машина назначена, детали поездки готовы.' },
  driver_arriving: { title: 'Водитель подъезжает', text: 'Оставайтесь у точки посадки, водитель уже рядом.' },
  in_progress: { title: 'Поездка началась', text: 'Едете по маршруту, статус обновляется автоматически.' },
  completed: { title: 'Поездка завершена', text: 'Спасибо, всё прошло успешно.' },
};

const STATUS_SEQUENCE: RideStatus[] = ['searching', 'driver_assigned', 'driver_arriving', 'in_progress', 'completed'];

export function RidePage() {
  const location = useLocation();
  const query = useMemo(() => parseRideQuery(location.search), [location.search]);

  const [stage, setStage] = useState<RideStage>('landing');
  const [pickup, setPickup] = useState<RidePoint>({
    id: query.pointId,
    latitude: query.coordinates.latitude,
    longitude: query.coordinates.longitude,
    label: 'Определяем точку посадки…',
  });
  const [destination, setDestination] = useState<RidePoint | undefined>();
  const [destinationQuery, setDestinationQuery] = useState('Аэропорт Усть-Каменогорск');
  const [destinationOptions, setDestinationOptions] = useState<RidePoint[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [route, setRoute] = useState<RideDraft['route']>();
  const [tariff, setTariff] = useState<Tariff>('economy');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [phone, setPhone] = useState('+7');
  const [verificationId, setVerificationId] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [smsHint, setSmsHint] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<RideOrder | null>(null);

  useEffect(() => {
    let cancelled = false;

    reverseGeocode(query.coordinates)
      .then((result) => {
        if (cancelled) return;
        setPickup({
          id: query.pointId,
          latitude: query.coordinates.latitude,
          longitude: query.coordinates.longitude,
          label: result.placeName,
          subtitle: result.locality?.name || result.areaName,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPickup((current) => ({
          ...current,
          label: `QR point #${query.pointId}`,
          subtitle: `${query.coordinates.latitude.toFixed(4)}, ${query.coordinates.longitude.toFixed(4)}`,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [query.coordinates, query.pointId]);

  useEffect(() => {
    let active = true;
    if (destinationQuery.trim().length < 3) {
      setDestinationOptions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      geocode(destinationQuery, query.coordinates)
        .then(({ results }) => {
          if (!active) return;
          setDestinationOptions(
            results.slice(0, 4).map((item, index) => ({
              id: `${item.address}-${index}`,
              label: item.address,
              subtitle: item.additionalInfo,
              latitude: item.latitude,
              longitude: item.longitude,
            })),
          );
        })
        .catch(() => {
          if (!active) return;
          setDestinationOptions([]);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [destinationQuery, query.coordinates]);

  useEffect(() => {
    if (!pickup || !destination) {
      setRoute(undefined);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    setRouteError(null);

    buildRoute([
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ])
      .then((result) => {
        if (!cancelled) {
          setRoute(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(undefined);
          setRouteError('Не удалось получить маршрут APARU Maps. Для демо можно продолжить без точной трассировки.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRouteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pickup, destination]);

  useEffect(() => {
    if (!order || order.status === 'completed') return;

    const timeout = window.setTimeout(() => {
      const nextStatus = getNextStatus(order.status);
      const nextOrder = hydrateOrderStatus(order, nextStatus);
      setOrder(nextOrder);
      if (nextStatus === 'completed') {
        window.setTimeout(() => setStage('cta'), 1400);
      }
    }, order.status === 'searching' ? 2200 : 3000);

    return () => window.clearTimeout(timeout);
  }, [order]);

  const fare = useMemo(() => {
    if (!route) return tariff === 'economy' ? 890 : tariff === 'comfort' ? 1250 : 1690;
    const base = tariff === 'economy' ? 890 : tariff === 'comfort' ? 1250 : 1690;
    return base + Math.round(route.distance / 22);
  }, [route, tariff]);

  const rideDraft: RideDraft | null = pickup
    ? {
        pickup,
        destination,
        route,
        tariff,
        paymentMethod,
        phone,
      }
    : null;

  const requestCode = async () => {
    const formatted = formatPhoneInput(phone);
    setPhone(formatted);
    if (!phoneIsValid(formatted)) return;

    setSubmitting(true);
    try {
      const session = await requestSmsCode(formatted);
      setVerificationId(session.verificationId);
      setSmsHint(`Демо-код: ${session.code}`);
      setStage('verify');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = async () => {
    if (!codeIsValid(verificationCode)) return;
    setSubmitting(true);
    try {
      const result = await verifySmsCode(verificationId, verificationCode);
      if (result.ok) {
        setStage('confirm');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const createOrder = async () => {
    if (!rideDraft || !rideDraft.destination) return;
    setSubmitting(true);
    try {
      const created = await createMockOrder(rideDraft);
      setOrder(created);
      setStage('status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[var(--content-width)] flex-col gap-4 px-4 py-6">
      <header className="rounded-[20px] border border-aparu-border bg-aparu-surface px-4 py-4 shadow-glow sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-aparu-border bg-aparu-surface-elevated">
                <img src="/aparu-logo.svg" alt="APARU" className="h-7 w-auto" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-aparu-muted">QR ride</div>
                <h1 className="truncate text-xl font-bold text-aparu-text sm:text-2xl">Закажите APARU за пару шагов</h1>
              </div>
            </div>
            <p className="max-w-[26rem] text-sm text-aparu-muted">Вход из QR уже сохранил вашу точку посадки. Дальше — только подтвердить телефон и поездку.</p>
          </div>
          <span className="shrink-0 rounded-full bg-aparu-accentSoft px-3 py-1.5 text-xs font-semibold text-aparu-accent">QR point #{query.pointId}</span>
        </div>
      </header>

      <section className="rounded-card border border-aparu-border bg-aparu-surface py-3 pl-3 pr-0">
        <Progress stage={stage} />
      </section>

      {(stage === 'landing' || stage === 'verify' || stage === 'confirm') && (
        <RouteMap pickup={pickup} destination={destination} route={route} />
      )}

      {stage === 'landing' && (
        <section className="space-y-4 rounded-card border border-aparu-border bg-aparu-surface p-5">
          <AddressCard title="Точка посадки" label={pickup.label} subtitle={pickup.subtitle} badge="A" />
          <div className="space-y-3">
            <label className="text-sm font-medium text-aparu-text">Куда поедем?</label>
            <input
              value={destinationQuery}
              onChange={(event) => setDestinationQuery(event.target.value)}
              placeholder="Введите адрес или место"
              className="w-full rounded-card border border-aparu-border bg-aparu-surface px-4 py-4 text-aparu-text outline-none transition focus:border-aparu-accent"
            />
            <div className="space-y-2">
              {destinationOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setDestination(option);
                    setDestinationQuery(option.label);
                    setDestinationOptions([]);
                  }}
                  className={`w-full rounded-card border px-4 py-3 text-left transition ${destination?.id === option.id ? 'border-aparu-accent bg-aparu-accentSoft' : 'border-aparu-border bg-aparu-surface hover:border-aparu-accent/50'}`}
                >
                  <div className="font-medium text-aparu-text">{option.label}</div>
                  <div className="text-xs text-aparu-muted">{option.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TARIFFS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTariff(item.id)}
                className={`flex min-w-0 flex-col rounded-card border p-3 text-left transition ${tariff === item.id ? 'border-aparu-accent bg-aparu-accentSoft' : 'border-aparu-border bg-aparu-surface-elevated'}`}
              >
                <div className="font-semibold text-aparu-text">{item.title}</div>
                <div className="mt-1 text-xs text-aparu-muted">{item.subtitle}</div>
                <div className="mt-2 text-xs font-semibold text-aparu-accent">{item.multiplier}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['card', 'cash'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`rounded-card border px-4 py-3 text-sm font-medium transition ${paymentMethod === method ? 'border-aparu-accent bg-aparu-accentSoft text-aparu-text' : 'border-aparu-border bg-aparu-surface-elevated text-aparu-muted'}`}
              >
                {method === 'card' ? 'Карта' : 'Наличные'}
              </button>
            ))}
          </div>

          <div className="rounded-card border border-aparu-border bg-aparu-surface-elevated p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-aparu-muted">Оценка поездки</span>
              <span className="font-semibold text-aparu-accent">{fare} ₸</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-aparu-muted">Маршрут</span>
              <span className="text-aparu-text">
                {routeLoading ? 'Считаем…' : route ? `${formatDistance(route.distance)} · ${formatMinutes(route.time)}` : 'Выберите точку B'}
              </span>
            </div>
            {routeError ? <p className="mt-2 text-xs text-aparu-danger">{routeError}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-aparu-text">Телефон для входа</label>
            <PhoneInput value={phone} onChange={(value) => setPhone(formatPhoneInput(value))} />
            <p className="text-xs text-aparu-muted">Номер нужен только для подтверждения и будущей интеграции с backend.</p>
          </div>

          <button
            type="button"
            disabled={!destination || !phoneIsValid(phone) || submitting}
            onClick={requestCode}
            className="w-full rounded-button bg-aparu-accent px-4 py-4 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Отправляем код…' : 'Получить код'}
          </button>
        </section>
      )}

      {stage === 'verify' && (
        <section className="space-y-4 rounded-card border border-aparu-border bg-aparu-surface p-5">
          <h2 className="text-xl font-semibold">Подтвердите номер</h2>
          <p className="text-sm text-aparu-muted">Код отправлен на {phone}. Для демо мы показываем его прямо в интерфейсе.</p>
          <div className="rounded-card border border-aparu-accent/30 bg-aparu-accentSoft p-4 text-sm text-aparu-text">{smsHint}</div>
          <input
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="4 цифры"
            className="w-full rounded-card border border-aparu-border bg-aparu-surface-elevated px-4 py-4 text-center text-2xl tracking-[0.35em] text-aparu-text outline-none transition focus:border-aparu-accent"
          />
          <button
            type="button"
            disabled={!codeIsValid(verificationCode) || submitting}
            onClick={confirmCode}
            className="w-full rounded-button bg-aparu-accent px-4 py-4 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Проверяем…' : 'Подтвердить код'}
          </button>
          <button type="button" onClick={() => setStage('landing')} className="w-full text-sm text-aparu-muted underline underline-offset-4">Вернуться к заказу</button>
        </section>
      )}

      {stage === 'confirm' && rideDraft && rideDraft.destination && (
        <section className="space-y-4 rounded-card border border-aparu-border bg-aparu-surface p-5">
          <h2 className="text-xl font-semibold">Проверьте заказ</h2>
          <AddressCard title="Откуда" label={rideDraft.pickup.label} subtitle={rideDraft.pickup.subtitle} badge="A" />
          <AddressCard title="Куда" label={rideDraft.destination.label} subtitle={rideDraft.destination.subtitle} badge="B" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryCard label="Тариф" value={TARIFFS.find((item) => item.id === tariff)?.title ?? tariff} />
            <SummaryCard label="Оплата" value={paymentMethod === 'card' ? 'Картой' : 'Наличными'} />
            <SummaryCard label="Оценка" value={`${fare} ₸`} />
            <SummaryCard label="Маршрут" value={route ? `${formatDistance(route.distance)} · ${formatMinutes(route.time)}` : 'Демо-режим'} />
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={createOrder}
            className="w-full rounded-button bg-aparu-accent px-4 py-4 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Создаём заказ…' : 'Подтвердить заказ'}
          </button>
        </section>
      )}

      {stage === 'status' && order && (
        <section className="space-y-4 rounded-card border border-aparu-border bg-aparu-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{STATUS_META[order.status].title}</h2>
              <p className="mt-1 text-sm text-aparu-muted">{STATUS_META[order.status].text}</p>
            </div>
            <div className="rounded-full bg-aparu-accentSoft px-3 py-2 text-sm font-semibold text-aparu-accent">#{order.id.slice(-6)}</div>
          </div>

          <div className="space-y-3">
            {STATUS_SEQUENCE.map((status, index) => {
              const activeIndex = STATUS_SEQUENCE.indexOf(order.status);
              const isDone = index <= activeIndex;
              return (
                <div key={status} className={`flex min-w-0 gap-3 rounded-card border p-3 ${isDone ? 'border-aparu-accent/40 bg-aparu-accentSoft' : 'border-aparu-border bg-aparu-surface-elevated'}`}>
                  <div className={`mt-1 h-3 w-3 rounded-full ${isDone ? 'bg-aparu-accent' : 'bg-aparu-border'}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-aparu-text">{STATUS_META[status].title}</div>
                    <div className="text-xs text-aparu-muted">{STATUS_META[status].text}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {order.driver ? (
            <div className="rounded-card border border-aparu-border bg-aparu-surface-elevated p-4">
              <div className="text-sm font-semibold text-aparu-text">Ваш водитель</div>
              <div className="mt-2 text-lg font-semibold text-aparu-accent">{order.driver.name}</div>
              <div className="text-sm text-aparu-muted">{order.driver.car} · {order.driver.plate}</div>
              <div className="mt-2 text-xs text-aparu-muted">Рейтинг {order.driver.rating} · ETA {order.etaMinutes} мин</div>
            </div>
          ) : null}
        </section>
      )}

      {stage === 'cta' && order && (
        <section className="space-y-4 rounded-card border border-aparu-border bg-aparu-surface p-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aparu-accent text-3xl text-black">✓</div>
          <div>
            <h2 className="text-2xl font-semibold">Поездка завершена</h2>
            <p className="mt-2 text-sm text-aparu-muted">В следующий раз не сканируйте QR заново — поставьте приложение APARU и вызывайте машину в один тап.</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <a href="https://apps.apple.com/" target="_blank" rel="noreferrer" className="w-full rounded-button bg-aparu-accent px-4 py-4 font-semibold text-black transition hover:opacity-90">Скачать в App Store</a>
            <a href="https://play.google.com/store" target="_blank" rel="noreferrer" className="w-full rounded-button border border-aparu-border bg-aparu-surface-elevated px-4 py-4 font-semibold text-aparu-text transition hover:border-aparu-accent/40">Скачать в Google Play</a>
          </div>
          <button type="button" onClick={() => setStage('landing')} className="text-sm text-aparu-muted underline underline-offset-4">Оформить ещё одну поездку</button>
        </section>
      )}
    </main>
  );
}

function Progress({ stage }: { stage: RideStage }) {
  const steps: { id: RideStage; title: string }[] = [
    { id: 'landing', title: 'Маршрут' },
    { id: 'verify', title: 'Телефон' },
    { id: 'confirm', title: 'Подтверждение' },
    { id: 'status', title: 'Статус' },
    { id: 'cta', title: 'Установка' },
  ];
  const active = steps.findIndex((item) => item.id === stage);

  return (
    <div className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2 pr-3">
        {steps.map((item, index) => (
          <div
            key={item.id}
            className={`min-w-[110px] rounded-full px-4 py-2.5 text-center text-xs font-medium transition sm:min-w-0 sm:flex-1 ${index <= active ? 'bg-aparu-accent text-black' : 'bg-aparu-surface-elevated text-aparu-muted'}`}
          >
            <span className="block whitespace-nowrap">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressCard({ title, label, subtitle, badge }: { title: string; label: string; subtitle?: string; badge: string }) {
  return (
    <div className="flex min-w-0 gap-3 rounded-card border border-aparu-border bg-aparu-surface-elevated p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aparu-accent text-sm font-bold text-black">{badge}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.18em] text-aparu-muted">{title}</div>
        <div className="mt-1 break-words font-semibold text-aparu-text">{label}</div>
        {subtitle ? <div className="mt-1 text-sm text-aparu-muted">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-card border border-aparu-border bg-aparu-surface-elevated p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-aparu-muted">{label}</div>
      <div className="mt-2 break-words font-semibold text-aparu-text">{value}</div>
    </div>
  );
}
