import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, type Score } from '../api'
import TagReference from '../components/TagReference'

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

export default function AdminUpload() {
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [musicxml, setMusicxml] = useState<File | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [mscz, setMscz] = useState<File | null>(null)
  // Default to "test" — anonymous users won't see it. The admin flips it to
  // published once they've reviewed and the recording is final.
  const [published, setPublished] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Score | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])

  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const canSubmit =
    title.trim().length > 0 &&
    musicxml !== null &&
    pdf !== null &&
    !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)
    setFieldErrors([])
    setResult(null)

    try {
      const score = await api.createScore({
        metadata: {
          title: title.trim(),
          composer: composer.trim() || null,
          tags,
          published,
        },
        musicxml: musicxml!,
        pdf: pdf!,
        mscz,
      })
      setResult(score)
      // Reset content fields. Keep `published` at its current setting so the
      // admin doesn't have to re-tick it for a batch of similar uploads.
      setTitle('')
      setComposer('')
      setTagsRaw('')
      setMusicxml(null)
      setPdf(null)
      setMscz(null)
      // Reset file <input>s — they don't clear from setMscz(null) alone.
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

  return (
    <article>
      <h2>Upload a score</h2>

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
          ✓ Uploaded <strong>{result.title}</strong>{' '}
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
            placeholder="service:liturgy, language:english, voicing:satb"
            style={inputStyle}
          />
          {tags.length > 0 && (
            <small style={{ color: 'var(--text)' }}>
              Will be saved as: {tags.map((t) => `#${t}`).join(' ')}
            </small>
          )}
          <TagReference
            onAdd={(tag) =>
              setTagsRaw((prev) => {
                const existing = prev
                  .split(',')
                  .map((t) => t.trim().toLowerCase())
                  .filter(Boolean)
                if (existing.includes(tag.toLowerCase())) return prev
                return prev.trim() ? `${prev.replace(/,\s*$/, '')}, ${tag}` : tag
              })
            }
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="musicxml">MusicXML *</label>
          <input
            id="musicxml"
            type="file"
            accept=".musicxml,.xml,application/vnd.recordare.musicxml+xml"
            onChange={(e) => setMusicxml(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="pdf">PDF *</label>
          <input
            id="pdf"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
            required
          />
        </div>

        <div style={fieldStyle}>
          <label htmlFor="mscz">
            MuseScore archive{' '}
            <span style={{ color: 'var(--text)' }}>(.mscz, optional)</span>
          </label>
          <input
            id="mscz"
            type="file"
            accept=".mscz"
            onChange={(e) => setMscz(e.target.files?.[0] ?? null)}
          />
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
              <strong>Publish immediately</strong>
              <br />
              <small style={{ color: 'var(--text)' }}>
                When unchecked, the score is saved as a <em>test</em> version,
                visible only to signed-in users. You can flip it to published
                later from the edit page.
              </small>
            </span>
          </label>
        </fieldset>

        <button type="submit" disabled={!canSubmit} style={{ marginTop: 8 }}>
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </article>
  )
}
