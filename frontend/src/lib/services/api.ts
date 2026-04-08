/**
 * Centralized API client for the Aparu QR backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

let _token: string | null = localStorage.getItem('aparu_token')

export function setToken(token: string | null) {
  _token = token
  if (token) {
    localStorage.setItem('aparu_token', token)
  } else {
    localStorage.removeItem('aparu_token')
  }
}

export function getToken(): string | null {
  return _token
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, body.detail ?? 'Unknown error')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Auth ─────────────────────────────────────────────────

export interface SendCodeResponse {
  message: string
  code: string | null
}

export interface UserOut {
  id: number
  phone: string
  name: string
  role: 'admin' | 'driver' | 'user'
  is_active: boolean
}

export interface DriverProfileOut {
  id: number
  car_model: string
  car_color: string
  plate_number: string
  rating: number
  is_online: boolean
}

export interface UserWithProfile extends UserOut {
  driver_profile: DriverProfileOut | null
}

export interface AuthResponse {
  token: string
  user: UserOut
}

export const auth = {
  sendCode: (phone: string) =>
    request<SendCodeResponse>('/api/v1/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyCode: (phone: string, code: string) =>
    request<AuthResponse>('/api/v1/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  me: () => request<UserWithProfile>('/api/v1/auth/me'),
}

// ── Locations ────────────────────────────────────────────

export interface LocationOut {
  id: number
  latitude: number
  longitude: number
  is_active: boolean
  created_at: string
}

export const locations = {
  list: () => request<LocationOut[]>('/api/v1/locations'),
  get: (id: number) => request<LocationOut>(`/api/v1/locations/${id}`),
  create: (data: { latitude: number; longitude: number }) =>
    request<LocationOut>('/api/v1/locations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<LocationOut>) =>
    request<LocationOut>(`/api/v1/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/api/v1/locations/${id}`, { method: 'DELETE' }),
}

// ── Tariffs ──────────────────────────────────────────────

export interface TariffOut {
  id: number
  name: string
  base_price: number
  currency: string
  description: string
  is_active: boolean
}

export const tariffs = {
  list: () => request<TariffOut[]>('/api/v1/tariffs'),
  create: (data: { name: string; base_price: number; currency?: string; description?: string }) =>
    request<TariffOut>('/api/v1/tariffs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<TariffOut>) =>
    request<TariffOut>(`/api/v1/tariffs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<void>(`/api/v1/tariffs/${id}`, { method: 'DELETE' }),
}

// ── Orders ───────────────────────────────────────────────

export interface OrderOut {
  id: number
  user_id: number
  driver_id: number | null
  qr_location_id: number
  tariff_id: number
  destination_address: string
  destination_lat: number | null
  destination_lng: number | null
  status: 'searching' | 'assigned' | 'driving' | 'arrived' | 'completed' | 'cancelled'
  price: number
  created_at: string
  updated_at: string
  user_name: string | null
  driver_name: string | null
  location_name: string | null
  tariff_name: string | null
}

export const orders = {
  list: () => request<OrderOut[]>('/api/v1/orders'),
  get: (id: number) => request<OrderOut>(`/api/v1/orders/${id}`),
  create: (data: {
    qr_location_id: number
    tariff_id: number
    destination_address?: string
    destination_lat?: number
    destination_lng?: number
  }) => request<OrderOut>('/api/v1/orders', { method: 'POST', body: JSON.stringify(data) }),
  assign: (id: number) =>
    request<OrderOut>(`/api/v1/orders/${id}/assign`, { method: 'PATCH' }),
  updateStatus: (id: number, status: string) =>
    request<OrderOut>(`/api/v1/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

// ── Maps ─────────────────────────────────────────────────

export interface GeocodeResultItem {
  address: string
  additionalInfo: string
  latitude: number
  longitude: number
  type: 's' | 'h' | 'o' | 'c'
}

export interface ReverseGeocodeResponse {
  placeName: string | null
  areaName: string | null
  accuratePlace: boolean
  locality: { localityId: number; name: string; latitude: number; longitude: number } | null
}

export interface RouteResponse {
  distance: number
  time: number
  coordinates: [number, number][]
  bbox: number[]
}

export const maps = {
  geocode: (text: string, latitude: number, longitude: number) =>
    request<{ results: GeocodeResultItem[] }>('/api/v1/maps/geocode', {
      method: 'POST',
      body: JSON.stringify({ text, latitude, longitude, withCities: true }),
    }),
  reverseGeocode: (latitude: number, longitude: number) =>
    request<ReverseGeocodeResponse>('/api/v1/maps/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),
  route: (points: { latitude: number; longitude: number }[]) =>
    request<RouteResponse>('/api/v1/maps/route', {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
}

// ── Drivers ──────────────────────────────────────────────

export const drivers = {
  me: () => request<UserWithProfile>('/api/v1/drivers/me'),
  toggleOnline: () => request<DriverProfileOut>('/api/v1/drivers/me/online', { method: 'PATCH' }),
  list: () => request<UserWithProfile[]>('/api/v1/drivers'),
}
