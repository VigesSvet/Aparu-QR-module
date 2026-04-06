import { createBrowserRouter, Link } from 'react-router-dom';
import { RidePage } from '../features/ride/RidePage';

function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[var(--content-width)] flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/aparu-logo.svg" alt="APARU" className="h-20 w-auto" />
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-aparu-text">APARU QR demo</h1>
        <p className="text-sm text-aparu-muted">
          Мобильный сценарий заказа такси по QR. Для входа откройте маршрут
          {' '}
          <code className="rounded bg-aparu-surface-elevated px-2 py-1 text-aparu-accent">/ride?point=123&lat=49.9483&lng=82.6135</code>
        </p>
      </div>
      <Link
        to="/ride?point=123&lat=49.9483&lng=82.6135"
        className="w-full rounded-button bg-aparu-accent px-4 py-4 font-semibold text-black transition hover:opacity-90"
      >
        Открыть демо-маршрут
      </Link>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/ride',
    element: <RidePage />,
  },
]);
