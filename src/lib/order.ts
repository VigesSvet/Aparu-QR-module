import type { RideDraft, RideOrder } from '../types/ride';

const STATUS_SEQUENCE: RideOrder['status'][] = [
  'searching',
  'driver_assigned',
  'driver_arriving',
  'in_progress',
  'completed',
];

export async function createMockOrder(draft: RideDraft): Promise<RideOrder> {
  await delay(700);
  return {
    ...draft,
    id: `ride_${Date.now()}`,
    status: 'searching',
    etaMinutes: 4,
    fareEstimate: estimateFare(draft),
  };
}

export function getNextStatus(current: RideOrder['status']) {
  const index = STATUS_SEQUENCE.indexOf(current);
  return STATUS_SEQUENCE[Math.min(index + 1, STATUS_SEQUENCE.length - 1)];
}

export function hydrateOrderStatus(order: RideOrder, status: RideOrder['status']): RideOrder {
  if (status === 'driver_assigned' || status === 'driver_arriving' || status === 'in_progress' || status === 'completed') {
    return {
      ...order,
      status,
      etaMinutes: status === 'driver_arriving' ? 2 : status === 'in_progress' ? 12 : 0,
      driver: {
        name: 'Арман',
        car: 'Hyundai Elantra · белый',
        plate: '786 ARA 17',
        rating: 4.9,
      },
    };
  }

  return {
    ...order,
    status,
  };
}

function estimateFare(draft: RideDraft) {
  const base = 890;
  const multiplier = draft.tariff === 'comfort' ? 1.35 : draft.tariff === 'business' ? 1.9 : 1;
  const routePart = draft.route ? Math.round((draft.route.distance / 1000) * 120) : 250;
  return Math.round((base + routePart) * multiplier);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
