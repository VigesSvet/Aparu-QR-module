const KEY = 'qr_base_url'

export function getQRBaseUrl(): string {
  return localStorage.getItem(KEY) ?? window.location.origin
}

export function setQRBaseUrl(url: string): void {
  localStorage.setItem(KEY, url.replace(/\/+$/, ''))
}
