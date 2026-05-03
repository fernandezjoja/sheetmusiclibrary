import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type Score } from '../api'
import AdminRecordingsSection from '../components/AdminRecordingsSection'
import AdminReferencesSection from '../components/AdminReferencesSection'

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  marginBottom: 12,
}

const inputStyle = {
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text-h)',
  font: 'inherit',
}

export default function AdminEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  // Full loaded score, kept fresh after each attachment mutation so the
  // sections re-render. Updated separately from the form-input state because
  // the form fields preserve user-in-progress edits independent of refetches.
  const [score, setScore] = useState<Score | null>(null)

  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [musicxml, setMusicxml] = useState<File | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [mscz, setMscz] = useState<File | null>(null)
  const [published, setPublished] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result, setResult] = useState<Score | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  // Pre-fill the form with the score's current metadata. Runs on mount and
  // whenever an attachment mutation triggers a refetch (refetchKey).
  const [refetchKey, setRefetchKey] = useState(0)
  const refetch = useCallback(() => setRefetchKey((k) => k + 1), [])

  useEffect(() => {
    if (!id) return
    setLoadStatus('loading')
    setLoadError(null)
    api
      .getScore(id)
      .then((s) => {
        setScore(s)
        // Only seed the form on the *initial* load; subsequent refetches
        // (after attachment changes) shouldn't blow away user-in-progress edits.
        if (refetchKey === 0) {
          setTitle(s.title)
          setComposer(s.composer ?? '')
          setTagsRaw(s.tags.join(', '))
          setPublished(s.published)
        }
        setLoadStatus('loaded')
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : String(e))
        setLoadStatus('error')
      })
    // refetchKey is intentionally a dep — bumping it re-runs this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, refetchKey])

  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const canSubmit =
    title.trim().length > 0 &&
    !submitting &&
    loadStatus === 'loaded'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !id) return

    setSubmitting(true)
    setError(null)
    setFieldErrors([])
    setResult(null)

    try {
      const score = await api.updateScore(id, {
        // Always send metadata so any field changes apply. Files are only
        // sent if the user picked one — backend leaves omitted parts alone.
        metadata: {
          title: title.trim(),
          composer: composer.trim() || null,
          tags,
          published,
        },
        musicxml,
        pdf,
        mscz,
      })
      setResult(score)
      // Reset just the file pickers; keep metadata fields populated for
      // further edits.
      setMusicxml(null)
      setPdf(null)
      setMscz(null)
      const fileInputs = document.querySelectorAll<HTMLInputElement>(
        'input[type="file"]',
      )
      fileInputs.forEach((el) => {
        el.value = ''
      })
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setError(e.message)
        setFieldErrors(e.fieldErrors)
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    const ok = window.confirm(
      `Delete "${title}"?\n\nThis removes the score, all its files, and any attached recordings, references, and notes. Cannot be undone.`,
    )
    if (!ok) return
    setDeleting(true)
    setError(null)
    setFieldErrors([])
    try {
      await api.deleteScore(id)
      navigate('/biblioteca', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setDeleting(false)
    }
  }

  if (loadStatus === 'loading') {
    return <p>Loading score…</p>
  }
  if (loadStatus === 'error') {
    return (
      <div>
        <p role="alert">Failed to load score: {loadError}</p>
        <Link to="/biblioteca">← Back to all scores</Link>
      </div>
    )
  }

  return (
    <article>
      <h2>Edit score #{id}</h2>

      {result && (
        <div
          role="status"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
            background: 'var(--code-bg)',
          }}
        >
          ✓ Updated <strong>{result.title}</strong>{' '}
          {result.composer ? `by ${result.composer}` : ''}{' '}
          {result.published ? '(published)' : '(test — admins only)'} —{' '}
          <Link to={`/scores/${result.id}`}>open it</Link>.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            border: '1px solid #c44',
            borderRadius: 4,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <strong>{error}</strong>
          {fieldErrors.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {fieldErrors.map((fe, i) => (
                <li key={i}>{fe}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div style={fieldStyle}>
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="composer">Composer</label>
          <input
            id="composer"
            type="text"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="tags">
            Tags <span style={{ color: 'var(--text)' }}>(comma-separated)</span>
          </label>
          <input
            id="tags"
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="sacred, romantic"
            style={inputStyle}
          />
          {tags.length > 0 && (
            <small style={{ color: 'var(--text)' }}>
              Will be saved as: {tags.map((t) => `#${t}`).join(' ')}
            </small>
          )}
        </div>

        <fieldset
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: 12,
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <legend>Visibility</legend>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            <span>
              <strong>Published</strong>
              <br />
              <small style={{ color: 'var(--text)' }}>
                {published
                  ? 'Visible to anonymous visitors. Uncheck to revert to test.'
                  : 'Test version — visible only to signed-in users. Check to make it public.'}
              </small>
            </span>
          </label>
        </fieldset>

        <p style={{ color: 'var(--text)', fontSize: '0.9rem', marginTop: 16 }}>
          File uploads below are <em>optional</em>. Leave blank to keep the
          existing files; pick a file to replace it.
        </p>

        <div style={fieldStyle}>
          <label htmlFor="musicxml">Replace MusicXML</label>
          <input
            id="musicxml"
            type="file"
            accept=".musicxml,.xml,application/vnd.recordare.musicxml+xml"
            onChange={(e) => setMusicxml(e.target.files?.[0] ?? null)}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="pdf">Replace PDF</label>
          <input
            id="pdf"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="mscz">Replace MuseScore archive (.mscz)</label>
          <input
            id="mscz"
            type="file"
            accept=".mscz"
            onChange={(e) => setMscz(e.target.files?.[0] ?? null)}
          />
        </div>

        <button type="submit" disabled={!canSubmit} style={{ marginTop: 8 }}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {score && (
        <>
          <AdminRecordingsSection score={score} onChange={refetch} />
          <AdminReferencesSection score={score} onChange={refetch} />
        </>
      )}

      <fieldset
        style={{
          border: '1px solid #c44',
          borderRadius: 4,
          padding: 12,
          marginTop: 32,
          maxWidth: 560,
        }}
      >
        <legend style={{ color: '#c44' }}>Danger zone</legend>
        <p style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: '0.9rem' }}>
          Deleting removes the score, its files (MusicXML, PDF, .mscz), and all
          attached recordings, references, and notes. Cannot be undone.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || submitting || loadStatus !== 'loaded'}
          style={{
            background: '#c44',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: deleting ? 'wait' : 'pointer',
          }}
        >
          {deleting ? 'Deleting…' : 'Delete this score'}
        </button>
      </fieldset>

      <p style={{ marginTop: 24 }}>
        <Link to={`/scores/${id}`}>← Back to score</Link>
      </p>
    </article>
  )
}
