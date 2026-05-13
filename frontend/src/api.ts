export type ScoreNote = {
  id: number
  body: string
  sortOrder: number
  createdAt: string
}

export type ScoreRecording = {
  id: number
  path: string
  label: string | null
  originalFilename: string | null
  sortOrder: number
  uploadedAt: string
  notes: ScoreNote[]
}

export type ScoreReference = {
  id: number
  url: string
  label: string | null
  kind: string | null
  sortOrder: number
  notes: ScoreNote[]
}

export type Score = {
  id: number
  title: string
  composer: string | null
  tags: string[]
  musicxmlPath: string | null
  pdfPath: string | null
  /**
   * True only when the score has a .mscz file *and* the requester has
   * permission to download it (COLLABORATOR or higher). Server-set; the
   * frontend just renders the download UI when this is true.
   */
  hasMscz: boolean
  published: boolean
  recordings: ScoreRecording[]
  references: ScoreReference[]
}

/**
 * Slim shape returned by GET /api/scores (the listing endpoint). Carries
 * only what the library / admin / Octoechos / Grandes-Fiestas pages render
 * — no recordings, references, notes, or raw file paths. Use {@link Score}
 * (via api.getScore) when you need the full nested data.
 */
export type ScoreListItem = {
  id: number
  title: string
  composer: string | null
  tags: string[]
  published: boolean
  hasMusicxml: boolean
  hasPdf: boolean
  hasMscz: boolean
}

export type ScoreMetadata = {
  title: string
  composer: string | null
  tags: string[]
  // Optional on update — backend treats null/undefined as "leave unchanged".
  published?: boolean
}

export type CreateRecordingDraft = {
  file: File
  label: string | null
  /** One note body per array entry; blank entries are dropped on submit. */
  notes: string[]
}

export type CreateReferenceDraft = {
  url: string
  label: string | null
  kind: string | null
  notes: string[]
}

export type CreateScoreParams = {
  metadata: ScoreMetadata
  musicxml: File
  pdf: File
  mscz: File | null
  /** Optional initial attachments — created atomically with the score. */
  recordings?: CreateRecordingDraft[]
  references?: CreateReferenceDraft[]
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

  // Build the metadata JSON, including any nested recordings/references with
  // their notes. Blank notes are dropped to keep the request clean.
  const metadata: Record<string, unknown> = { ...params.metadata }
  if (params.recordings && params.recordings.length > 0) {
    metadata.recordings = params.recordings.map((r) => ({
      label: r.label,
      notes: r.notes
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((body) => ({ body })),
    }))
  }
  if (params.references && params.references.length > 0) {
    metadata.references = params.references.map((r) => ({
      url: r.url,
      label: r.label,
      kind: r.kind,
      notes: r.notes
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((body) => ({ body })),
    }))
  }

  // Wrap metadata in a Blob so the multipart part carries Content-Type:
  // application/json — which is what `@RequestPart CreateScoreRequest`
  // expects on the backend (otherwise: 415).
  fd.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  fd.append('musicxml', params.musicxml)
  fd.append('pdf', params.pdf)
  if (params.mscz) fd.append('mscz', params.mscz)

  // Repeated 'recording' multipart parts, matched to metadata.recordings[i]
  // by index on the backend.
  for (const r of params.recordings ?? []) {
    fd.append('recording', r.file)
  }

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

async function deleteScore(id: string | number): Promise<void> {
  const res = await apiFetch(`/api/admin/scores/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (res.status === 401) throw new ApiError('Not signed in', 401)
  if (res.status === 403) throw new ApiError('Admin privileges required', 403)
  if (res.status === 404) throw new ApiError('Score not found', 404)
  throw new ApiError(`${res.status} ${res.statusText}`, res.status)
}

/**
 * Standard error mapping for /api/admin/* mutations: unauthenticated → 401,
 * non-admin → 403, missing target → 404, validation failure → 400 (with
 * field-level detail when the backend returns it), anything else surfaces
 * the HTTP status as a generic ApiError.
 */
async function expectAdminOk<T>(
  res: Response,
  parseBody: (r: Response) => Promise<T>,
): Promise<T> {
  if (res.ok) return parseBody(res)
  if (res.status === 401) throw new ApiError('Not signed in', 401)
  if (res.status === 403) throw new ApiError('Admin privileges required', 403)
  if (res.status === 404) throw new ApiError('Not found', 404)
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as {
      detail?: string
      errors?: string[]
    }
    throw new ApiError(body.detail ?? 'Validation failed', 400, body.errors ?? [])
  }
  throw new ApiError(`${res.status} ${res.statusText}`, res.status)
}

async function jsonPost<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return expectAdminOk(res, (r) => r.json() as Promise<T>)
}

async function jsonPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return expectAdminOk(res, (r) => r.json() as Promise<T>)
}

async function deleteUrl(url: string): Promise<void> {
  const res = await apiFetch(url, { method: 'DELETE' })
  return expectAdminOk(res, async () => undefined as void)
}

async function createRecording(
  scoreId: string | number,
  file: File,
  label: string | null,
): Promise<ScoreRecording> {
  const fd = new FormData()
  fd.append('file', file)
  if (label && label.trim()) fd.append('label', label.trim())
  const res = await apiFetch(`/api/admin/scores/${scoreId}/recordings`, {
    method: 'POST',
    body: fd,
  })
  return expectAdminOk(res, (r) => r.json() as Promise<ScoreRecording>)
}

async function updateRecording(
  scoreId: string | number,
  recordingId: string | number,
  params: { label?: string | null; sortOrder?: number },
): Promise<ScoreRecording> {
  return jsonPatch(`/api/admin/scores/${scoreId}/recordings/${recordingId}`, params)
}

async function deleteRecording(
  scoreId: string | number,
  recordingId: string | number,
): Promise<void> {
  return deleteUrl(`/api/admin/scores/${scoreId}/recordings/${recordingId}`)
}

async function createReference(
  scoreId: string | number,
  body: { url: string; label?: string | null; kind?: string | null; sortOrder?: number },
): Promise<ScoreReference> {
  return jsonPost(`/api/admin/scores/${scoreId}/references`, body)
}

async function updateReference(
  scoreId: string | number,
  referenceId: string | number,
  params: { url?: string; label?: string | null; kind?: string | null; sortOrder?: number },
): Promise<ScoreReference> {
  return jsonPatch(`/api/admin/scores/${scoreId}/references/${referenceId}`, params)
}

async function deleteReference(
  scoreId: string | number,
  referenceId: string | number,
): Promise<void> {
  return deleteUrl(`/api/admin/scores/${scoreId}/references/${referenceId}`)
}

async function createRecordingNote(
  scoreId: string | number,
  recordingId: string | number,
  body: string,
): Promise<ScoreNote> {
  return jsonPost(`/api/admin/scores/${scoreId}/recordings/${recordingId}/notes`, { body })
}

async function updateRecordingNote(
  scoreId: string | number,
  recordingId: string | number,
  noteId: string | number,
  params: { body?: string; sortOrder?: number },
): Promise<ScoreNote> {
  return jsonPatch(
    `/api/admin/scores/${scoreId}/recordings/${recordingId}/notes/${noteId}`,
    params,
  )
}

async function deleteRecordingNote(
  scoreId: string | number,
  recordingId: string | number,
  noteId: string | number,
): Promise<void> {
  return deleteUrl(
    `/api/admin/scores/${scoreId}/recordings/${recordingId}/notes/${noteId}`,
  )
}

async function createReferenceNote(
  scoreId: string | number,
  referenceId: string | number,
  body: string,
): Promise<ScoreNote> {
  return jsonPost(`/api/admin/scores/${scoreId}/references/${referenceId}/notes`, { body })
}

async function updateReferenceNote(
  scoreId: string | number,
  referenceId: string | number,
  noteId: string | number,
  params: { body?: string; sortOrder?: number },
): Promise<ScoreNote> {
  return jsonPatch(
    `/api/admin/scores/${scoreId}/references/${referenceId}/notes/${noteId}`,
    params,
  )
}

async function deleteReferenceNote(
  scoreId: string | number,
  referenceId: string | number,
  noteId: string | number,
): Promise<void> {
  return deleteUrl(
    `/api/admin/scores/${scoreId}/references/${referenceId}/notes/${noteId}`,
  )
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
  listScores: () => getJson<ScoreListItem[]>('/api/scores'),
  getScore: (id: string | number) => getJson<Score>(`/api/scores/${id}`),
  pdfUrl: (id: string | number) => `/api/scores/${id}/pdf`,
  musicxmlUrl: (id: string | number) => `/api/scores/${id}/musicxml`,
  msczUrl: (id: string | number) => `/api/scores/${id}/mscz`,
  recordingUrl: (scoreId: string | number, recordingId: string | number) =>
    `/api/scores/${scoreId}/recordings/${recordingId}`,
  login,
  logout,
  me,
  createScore,
  updateScore,
  deleteScore,
  createRecording,
  updateRecording,
  deleteRecording,
  createReference,
  updateReference,
  deleteReference,
  createRecordingNote,
  updateRecordingNote,
  deleteRecordingNote,
  createReferenceNote,
  updateReferenceNote,
  deleteReferenceNote,
}
