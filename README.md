# APARU QR module

Первая рабочая демо-версия QR-сценария заказа такси APARU.

## Stack
- Vite
- React 18
- TypeScript
- React Router
- Tailwind CSS
- Leaflet / React Leaflet

## Run
```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Env
Скопируйте `.env.example` в `.env` при необходимости.

```env
VITE_APARU_MAPS_BASE_URL=http://testtaxi3.aparu.kz
VITE_APARU_MAPS_API_KEY=test1
```

## Demo entrypoint
```text
/ride?point=123&lat=49.9483&lng=82.6135
```

## Architecture
- `src/app` — router и route entrypoints
- `src/features/ride` — основной flow заказа
- `src/components` — UI и карта
- `src/lib/services` — typed APARU Maps client
- `src/lib/sms.ts` — mock SMS service
- `src/lib/order.ts` — mock order service
- `src/types` — доменные типы для будущего backend seam
