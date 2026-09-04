const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: options.body instanceof FormData
      ? undefined
      : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Erreur HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
}

export function thumbnailUrl(videoId) {
  return `${BASE}/videos/thumbnail?id=${videoId}`
}

export function storyboardUrl(videoId) {
  return `${BASE}/videos/storyboard?id=${videoId}`
}
