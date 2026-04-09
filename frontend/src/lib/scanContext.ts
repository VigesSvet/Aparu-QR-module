const CURRENT_SCAN_LOCATION_KEY = 'aparu_scan_location'
const LAST_SCAN_LOCATION_KEY = 'aparu_last_scan_location'
const SELECTED_TARIFF_KEY = 'aparu_scan_tariff'
const DEFAULT_LOCATION_ID = 1

function parseLocationId(value: string | null): number | null {
  if (!value) return null
  const id = Number.parseInt(value, 10)
  return Number.isNaN(id) ? null : id
}

export function saveScanLocation(locationId: number) {
  const value = String(locationId)
  sessionStorage.setItem(CURRENT_SCAN_LOCATION_KEY, value)
  localStorage.setItem(LAST_SCAN_LOCATION_KEY, value)
}

export function clearSelectedTariff() {
  sessionStorage.removeItem(SELECTED_TARIFF_KEY)
}

export function getCurrentScanLocationId() {
  return parseLocationId(sessionStorage.getItem(CURRENT_SCAN_LOCATION_KEY))
}

export function getLastScanLocationId() {
  return parseLocationId(localStorage.getItem(LAST_SCAN_LOCATION_KEY))
}

export function getActiveScanLocationId() {
  return getCurrentScanLocationId() ?? getLastScanLocationId() ?? DEFAULT_LOCATION_ID
}

export function getRepeatScanPath() {
  return `/scan/${getActiveScanLocationId()}`
}
