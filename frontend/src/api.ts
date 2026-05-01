export type Score = {
  id: number
  title: string
  composer: string | null
  tags: string[]
  musicxmlPath: string | null
  pdfPath: string | null
  msczPath: string | null
}

export type CreateScoreParams = {
  username: string
  password: string
  metadata: { title: string; composer: string | null; tags: string[] }
  musicxml: File
  pdf: File
  mscz: File | null
}

export type UpdateScoreParams = {
  username: string
  password: string
  // Any subset of these may be provided; omitted parts leave the existing
  // value alone (matches the backend's PATCH semantics).
  metadata?: { title: string; composer: string | null; tags: string[] }
  musicxml?: File | null
  pdf?: File | null
  mscz?: File | null
}

export class ApiError extends Error {
  status: number
  fieldErrors: string[]
  constructor(message: string, status: number, fieldErrors: string[] = []) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 404) throw new ApiError('Not found', 404)
  if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status)
  return res.json() as Promise<T>
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

  const auth = 'Basic ' + btoa(`${params.username}:${params.password}`)
  const res = await fetch('/api/admin/scores', {
    method: 'POST',
    headers: { Authorization: auth },
    body: fd,
  })

  if (res.status === 201) return res.json() as Promise<Score>
  if (res.status === 401) throw new ApiError('Invalid admin credentials', 401)
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

  const auth = 'Basic ' + btoa(`${params.username}:${params.password}`)
  const res = await fetch(`/api/admin/scores/${id}`, {
    method: 'PATCH',
    headers: { Authorization: auth },
    body: fd,
  })

  if (res.status === 200) return res.json() as Promise<Score>
  if (res.status === 401) throw new ApiError('Invalid admin credentials', 401)
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
  createScore,
  updateScore,
}
