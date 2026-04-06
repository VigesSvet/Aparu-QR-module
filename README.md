# APARU QR Module

Первая рабочая демо-версия QR-сценария заказа такси APARU.

Приложение моделирует мобильный flow, в котором пользователь:
- сканирует QR-код в общественном месте,
- попадает в web-приложение с уже определённой точкой отправления,
- подтверждает номер телефона через SMS,
- выбирает точку назначения,
- подтверждает заказ,
- видит статус поездки,
- после завершения получает CTA на установку приложения APARU.

## Что это сейчас

Это **frontend-first demo/MVP pass**, собранный так, чтобы:
- быстро проверить пользовательский сценарий;
- сохранить визуальный язык APARU;
- использовать APARU Maps API как обязательную основу для гео-логики;
- не закопать проект в оверинжиниринг;
- оставить чистые швы под будущий backend на **FastAPI + PostgreSQL**.

## Текущий стек

- **Vite**
- **React 18**
- **TypeScript**
- **React Router**
- **Tailwind CSS**
- **Leaflet / React Leaflet**

### Почему не Next.js

Для текущего этапа нужен быстрый, прозрачный mobile-first frontend без реальной server-side логики.
Так как production-backend планируется отдельно на **FastAPI/PostgreSQL**, Next.js на этом шаге добавлял бы больше рамки, чем пользы.

## Основной сценарий

Реализованный flow:
1. **QR landing** — вход по `/ride?point=<id>&lat=<lat>&lng=<lng>`
2. **Phone verification** — ввод телефона +7 и SMS-кода
3. **Order confirmation** — подтверждение заказа, тарифа и оплаты
4. **Ride status** — этапы поездки в реальном времени через mock progression
5. **Install CTA** — экран установки приложения после завершения поездки

## Визуальный язык

В проекте сохранены и зафиксированы правила визуального языка APARU:
- `VISUAL_LANGUAGE.md`
- `docs/visual-language.md`

Ключевые принципы:
- тёмный фон `#0D0D0D`
- жёлтый акцент `#FFD700`
- вторичный текст `#A0A0A0`
- поверхности `#1A1A1A`
- mobile-first
- max width контента `480px`
- крупные full-width CTA
- спокойные анимации без лишнего шума

## Архитектурные правила

Зафиксированы в:
- `docs/architecture-rules.md`
- `docs/workflow-rules.md`

Базовые принципы:
- UI не должен напрямую знать transport-детали интеграций;
- внешние API вынесены в service layer;
- SMS и order flow пока mock, но за адаптерными швами;
- код должен быть расширяемым под backend на FastAPI/PostgreSQL.

## Структура проекта

```text
.
├── docs/
├── integrations/
│   └── aparu-maps/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   └── types/
├── VISUAL_LANGUAGE.md
├── package.json
└── README.md
```

### По папкам

- `src/app` — router и route entrypoints
- `src/features/ride` — основной ride flow
- `src/components` — UI-компоненты и карта
- `src/hooks` — reusable hooks
- `src/lib/services` — typed integration layer для APARU Maps API
- `src/lib/sms.ts` — mock SMS service
- `src/lib/order.ts` — mock order service
- `src/lib/config` — env/config
- `src/types` — доменные типы под будущие backend seams
- `public` — статика, включая логотип APARU
- `integrations/aparu-maps` — исходные артефакты и документация по APARU Maps API

## Важные файлы

- `VISUAL_LANGUAGE.md` — краткая фиксация визуального языка
- `docs/visual-language.md` — расширенные UI-правила
- `docs/architecture-rules.md` — архитектурные ограничения и предпочтения
- `docs/workflow-rules.md` — правила изменений и done criteria
- `src/features/ride/RidePage.tsx` — основной пользовательский flow
- `src/lib/services/aparu-maps.ts` — клиент APARU Maps API
- `src/lib/sms.ts` — mock SMS
- `src/lib/order.ts` — mock заказа
- `src/lib/utils/ride-query.ts` — разбор QR query params
- `public/aparu-logo.svg` — логотип APARU

## Интеграция с APARU Maps API

В проекте обязательно используется APARU Maps API как база для гео-функций.

Сейчас заложены typed wrappers для:
- `geocode`
- `reverseGeocode`
- `route`
- seam под `tiles` config

Исходные документы сохранены в репозитории:
- `integrations/aparu-maps/GeoApi.md`
- `integrations/aparu-maps/Aparu Maps API.postman_collection.json`

## Переменные окружения

Создайте `.env` при необходимости на основе `.env.example`.

```env
VITE_APARU_MAPS_BASE_URL=http://testtaxi3.aparu.kz
VITE_APARU_MAPS_API_KEY=test1
```

По умолчанию приложение использует те же значения, что заданы в документации для демо-режима.

## Как поднять проект для теста

### 1. Установить зависимости

```bash
npm install
```

### 2. При необходимости создать `.env`

```bash
cp .env.example .env
```

### 3. Запустить dev server

```bash
npm run dev
```

После запуска откройте адрес, который покажет Vite (обычно `http://localhost:5173`).

### 4. Открыть демо-сценарий

Главный demo entrypoint:

```text
/ride?point=123&lat=49.9483&lng=82.6135
```

Полный пример локального URL:

```text
http://localhost:5173/ride?point=123&lat=49.9483&lng=82.6135
```

Также корневой маршрут `/` содержит кнопку быстрого входа в demo-flow.

## Команды

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

### Что делает каждая команда

- `npm run dev` — локальная разработка
- `npm run typecheck` — проверка TypeScript без сборки
- `npm run build` — production build + предварительный typecheck
- `npm run preview` — локальный просмотр production build

## Что уже работает

- вход по QR query params
- разбор `point`, `lat`, `lng`
- определение/уточнение точки A через reverse geocode
- ввод и валидация телефона в формате `+7`
- mock SMS-код
- ввод и валидация 4-значного кода
- выбор точки B через geocode suggestions
- расчёт route summary через APARU Maps API
- выбор тарифа
- выбор способа оплаты
- mock создание заказа
- mock progression статусов поездки
- финальный CTA на App Store / Google Play

## Известные ограничения

Это важно, чтобы не путать demo и production:

- **SMS не настоящая** — сейчас это mock service
- **создание заказа не настоящее** — тоже mock
- **нет backend persistence**
- **нет авторизации/сессий production-уровня**
- **нет полноценной интеграции с реальным taxi dispatch backend**
- **нет e2e-тестов**
- **кастомный APARU map style/tiles runtime ещё не доведён до полноценного UI-использования**

## Что логично делать дальше

Следующие разумные шаги:
1. выделить backend API-контракты под FastAPI;
2. спроектировать PostgreSQL-модели для ride/order/session flow;
3. заменить mock SMS и mock order на реальные backend endpoints;
4. довести карту до полноценного APARU map runtime;
5. добавить e2e и component tests;
6. определить production flow ошибок, retry и edge cases.

## Ветки

Текущая рабочая реализация собрана в ветке:
- `developing`

Базовая стабильная стартовая ветка:
- `main`

## Примечание

Если меняется визуальный язык, архитектурные границы или правила работы с APARU Maps API, обновляйте не только код, но и:
- `VISUAL_LANGUAGE.md`
- `docs/visual-language.md`
- `docs/architecture-rules.md`
- `docs/workflow-rules.md`

Иначе проектная память начнёт врать, а это дрянная привычка.