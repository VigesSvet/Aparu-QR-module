import { mapsConfig } from '../config/env';
import type { Coordinates, RouteSummary } from '../../types/ride';

export type GeocodeResult = {
  address: string;
  additionalInfo: string;
  latitude: number;
  longitude: number;
  type: string;
};

export type ReverseGeocodeResult = {
  placeName: string;
  areaName: string;
  accuratePlace: boolean;
  locality?: {
    localityId: number;
    name: string;
    latitude: number;
    longitude: number;
  };
};

export type TilesConfig = {
  tileUrlTemplate: string;
  format: string;
  minZoom: number;
  maxZoom: number;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${mapsConfig.baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': mapsConfig.apiKey,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `APARU Maps error ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function geocode(text: string, coordinates: Coordinates) {
  return request<{ results: GeocodeResult[] }>('/api/v1/maps/geocode', {
    method: 'POST',
    body: JSON.stringify({
      text,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      withCities: true,
    }),
  });
}

export async function reverseGeocode(coordinates: Coordinates) {
  return request<ReverseGeocodeResult>('/api/v1/maps/reverse-geocode', {
    method: 'POST',
    body: JSON.stringify(coordinates),
  });
}

export async function buildRoute(points: Coordinates[]) {
  return request<RouteSummary>('/api/v1/maps/route', {
    method: 'POST',
    body: JSON.stringify({ points }),
  });
}

export async function fetchTilesConfig() {
  return request<TilesConfig>('/api/v1/maps/tiles', { method: 'GET' });
}
