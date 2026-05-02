export type Score = {
  id: number
  title: string
  composer: string | null
  tags: string[]
  musicxmlPath: string | null
  pdfPath: string | null
  msczPath: string | null
  published: boolean
}

export type ScoreMetadata = {
  title: string
  composer: string | null
  tags: string[]
  // Optional on update — backend treats null/undefined as "leave unchanged".
  published?: boolean
}

export type CreateScoreParams = {
  metadata: ScoreMetadata
  musicxml: File
  pdf: File
  mscz: File | null
}

export type UpdateScoreParams = {
  // Any subset may be provided; omitted parts leave the existing value alone.
  metadata?: ScoreMetadata
  musicxml?: File | null
  pdf?: File | null
  mscz?: File | null
}

export type CurrentUser = { username: string; role: 'USER' | 'ADMIN' }

export class ApiError extends Error {
  status: number
  fieldErrors: string[]
  constructor(message: string, status: number, fieldErrors: string[] = []) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// All API calls go through here so the credentials option (cookie sending) is
// consistent. Same-origin is enough — the SPA and API share an origin in dev
// (via Vite proxy) and in prod (Spring serves the static SPA).
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: 'same-origin', ...init })
}

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url)
  if (res.status === 404) throw new ApiError('Not found', 404)
  if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status)
  return res.json() as Promise<T>
}

async function login(username: string, password: string): Promise<void> {
  // Spring Security's form login expects application/x-www-form-urlencoded
  // with `username` and `password` fields.
  const body = new URLSearchParams({ username, password })
  const res = await apiFetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status === 200) return
  if (res.status === 401) throw new ApiError('Invalid username or password', 401)
  throw new ApiError(`${res.status} ${res.statusText}`, res.status)
}

async function logout(): Promise<void> {
  const res = await apiFetch('/api/logout', { method: 'POST' })
  if (!res.ok && res.status !== 401) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status)
  }
}

async function me(): Promise<CurrentUser> {
  const res = await apiFetch('/api/me')
  if (res.status === 401) throw new ApiError('Not authenticated', 401)
  if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status)
  return res.json() as Promise<CurrentUser>
}

async function createScore(params: CreateScoreParams): Promise<Score> {
  const fd = new FormData()
  // Wrap metadata in a Blob so the multipart part carries Content-Type:
  // application/json — which is what `@RequestPart CreateScoreRequest`
  // expects on the backend (otherwise: 415).
  fd.append(
    'metadata',
    new Blob([JSON.stringify(params.metadata)], { type: 'application/json' }),
  )
  fd.append('musicxml', params.musicxml)
  fd.append('pdf', params.pdf)
  if (params.mscz) fd.append('mscz', params.mscz)

  const res = await apiFetch('/api/admin/scores', { method: 'POST', body: fd })

  if (res.status === 201) return res.json() as Promise<Score>
  if (res.status === 401) throw new ApiError('Not signed in', 401)
  if (res.status === 403) throw new ApiError('Admin privileges required', 403)
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      errors?: string[]
    }
    throw new ApiError(body.detail ?? 'Validation failed', 400, body.errors ?? [])
  }
  throw new ApiError(`${res.status} ${res.statusText}`, res.status)
}

async function updateScore(id: string | number, params: UpdateScoreParams): Promise<Score> {
  const fd = new FormData()
  if (params.metadata) {
    fd.append(
      'metadata',
      new Blob([JSON.stringify(params.metadata)], { type: 'application/json' }),
    )
  }
  if (params.musicxml) fd.append('musicxml', params.musicxml)
  if (params.pdf) fd.append('pdf', params.pdf)
  if (params.mscz) fd.append('mscz', params.mscz)

  const res = await apiFetch(`/api/admin/scores/${id}`, { method: 'PATCH', body: fd })

  if (res.status === 200) return res.json() as Promise<Score>
  if (res.status === 401) throw new ApiError('Not signed in', 401)
  if (res.status === 403) throw new ApiError('Admin privileges required', 403)
  if (res.status === 404) throw new ApiError('Score not found', 404)
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      errors?: string[]
    }
    throw new ApiError(body.detail ?? 'Validation failed', 400, body.errors ?? [])
  }
  throw new ApiError(`${res.status} ${res.statusText}`, res.status)
}

export const api = {
  listScores: () => getJson<Score[]>('/api/scores'),
  getScore: (id: string | number) => getJson<Score>(`/api/scores/${id}`),
  pdfUrl: (id: string | number) => `/api/scores/${id}/pdf`,
  musicxmlUrl: (id: string | number) => `/api/scores/${id}/musicxml`,
  login,
  logout,
  me,
  createScore,
  updateScore,
}
