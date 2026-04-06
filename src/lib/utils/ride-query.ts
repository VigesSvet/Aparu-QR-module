import type { Coordinates } from '../../types/ride';

const DEFAULT_COORDINATES: Coordinates = {
  latitude: 49.9483,
  longitude: 82.6135,
};

export function parseRideQuery(search: string) {
  const params = new URLSearchParams(search);
  const pointId = params.get('point') || 'unknown';
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lng'));

  return {
    pointId,
    coordinates: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : DEFAULT_COORDINATES,
  };
}
