let refreshPromise: Promise<string | null> | null = null

export function devTokenValid(token = localStorage.getItem('nokki_dev_token')): boolean {
  if (!token) return false
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(part))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5000
  } catch { return false }
}

export async function restoreDevSession(): Promise<string | null> {
  const current = localStorage.getItem('nokki_dev_token')
  if (devTokenValid(current)) return current
  if (!refreshPromise) {
    refreshPromise = fetch('/api/dev/auth/refresh', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json' },
    }).then(async response => {
      if (!response.ok) throw new Error('refresh_failed')
      const data = await response.json()
      localStorage.setItem('nokki_dev_token', data.token)
      return String(data.token)
    }).catch(() => {
      localStorage.removeItem('nokki_dev_token')
      return null
    }).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function devFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await restoreDevSession()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response = await fetch(input, { ...init, headers, credentials: 'include' })
  if (response.status !== 401 || String(input).includes('/api/dev/auth/refresh')) return response

  localStorage.removeItem('nokki_dev_token')
  const renewed = await restoreDevSession()
  if (!renewed) return response
  headers.set('Authorization', `Bearer ${renewed}`)
  response = await fetch(input, { ...init, headers, credentials: 'include' })
  return response
}

export async function logoutDevSession(): Promise<void> {
  try { await fetch('/api/dev/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
  localStorage.removeItem('nokki_dev_token')
}
