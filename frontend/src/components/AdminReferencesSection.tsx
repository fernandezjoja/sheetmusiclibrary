import { useState, type FormEvent } from 'react'
import { api, type Score, type ScoreReference } from '../api'
import AdminNotesEditor from './AdminNotesEditor'

type Props = {
  score: Score
  onChange: () => void
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/i

const linkBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  lineHeight: 1,
  padding: '0 6px',
}

const arrowBtn = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  lineHeight: 1,
  padding: '0 4px',
}

const inputStyle = {
  padding: '4px 6px',
  border: '1px solid var(--border)',
  borderRadius: 3,
  background: 'var(--bg)',
  color: 'var(--text-h)',
  font: 'inherit',
  fontSize: '0.9rem',
}

/** YouTube URL → 'youtube'; anything else → 'web' (left blank if URL is empty). */
function inferKind(url: string): string {
  if (!url) return ''
  return YOUTUBE_RE.test(url) ? 'youtube' : 'web'
}

type Draft = { url: string; label: string; kind: string }

export default function AdminReferencesSection({ score, onChange }: Props) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>({ url: '', label: '', kind: '' })

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createReference(score.id, {
        url: trimmedUrl,
        label: label.trim() || null,
        kind: inferKind(trimmedUrl) || null,
      })
      setUrl('')
      setLabel('')
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (rid: number, displayLabel: string) => {
    if (!window.confirm(`Eliminar la referencia "${displayLabel}"?`)) return
    setError(null)
    try {
      await api.deleteReference(score.id, rid)
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const startEdit = (ref: ScoreReference) => {
    setEditingId(ref.id)
    setEditDraft({
      url: ref.url,
      label: ref.label ?? '',
      kind: ref.kind ?? '',
    })
    setError(null)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft({ url: '', label: '', kind: '' })
  }
  const saveEdit = async (rid: number) => {
    const trimmedUrl = editDraft.url.trim()
    if (!trimmedUrl) return
    setSubmitting(true)
    setError(null)
    try {
      await api.updateReference(score.id, rid, {
        url: trimmedUrl,
        label: editDraft.label.trim() || null,
        kind: editDraft.kind.trim() || null,
      })
      setEditingId(null)
      setEditDraft({ url: '', label: '', kind: '' })
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const move = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction
    if (target < 0 || target >= score.references.length) return
    const me = score.references[idx]
    const neighbor = score.references[target]
    setSubmitting(true)
    setError(null)
    try {
      await api.updateReference(score.id, me.id, {
        sortOrder: neighbor.sortOrder + direction,
      })
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section style={{ marginTop: 24, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 12 }}>Referencias</h3>
      {score.references.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text)', fontStyle: 'italic' }}>
          (ninguna)
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {score.references.map((ref, idx) => {
            const display = ref.label || ref.url
            const isEditing = editingId === ref.id
            return (
              <li
                key={ref.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="url"
                      value={editDraft.url}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, url: e.target.value }))
                      }
                      placeholder="URL"
                      autoFocus
                      style={inputStyle}
                      disabled={submitting}
                    />
                    <input
                      type="text"
                      value={editDraft.label}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, label: e.target.value }))
                      }
                      placeholder="Etiqueta"
                      style={inputStyle}
                      disabled={submitting}
                    />
                    <input
                      type="text"
                      value={editDraft.kind}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, kind: e.target.value }))
                      }
                      placeholder="Tipo (youtube / web)"
                      style={inputStyle}
                      disabled={submitting}
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => saveEdit(ref.id)}
                        disabled={submitting || !editDraft.url.trim()}
                      >
                        Guardar
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={submitting}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                      gap: 12,
                    }}
                  >
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ wordBreak: 'break-all', flex: 1 }}
                    >
                      {display}
                    </a>
                    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={submitting || idx === 0}
                        style={arrowBtn}
                        title="Subir"
                        aria-label="Subir referencia"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={submitting || idx === score.references.length - 1}
                        style={arrowBtn}
                        title="Bajar"
                        aria-label="Bajar referencia"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(ref)}
                        style={{ ...linkBtn, color: 'var(--text)' }}
                        title="Editar referencia"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(ref.id, display)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #c44',
                          color: '#c44',
                          borderRadius: 3,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        Eliminar
                      </button>
                    </span>
                  </div>
                )}
                {!isEditing && ref.kind && (
                  <small style={{ color: 'var(--text)' }}>({ref.kind})</small>
                )}
                <AdminNotesEditor
                  notes={ref.notes}
                  onAdd={async (body) => {
                    await api.createReferenceNote(score.id, ref.id, body)
                    onChange()
                  }}
                  onUpdate={async (nid, params) => {
                    await api.updateReferenceNote(score.id, ref.id, nid, params)
                    onChange()
                  }}
                  onDelete={async (nid) => {
                    await api.deleteReferenceNote(score.id, ref.id, nid)
                    onChange()
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}

      <form
        onSubmit={handleAdd}
        style={{
          border: '1px dashed var(--border)',
          borderRadius: 4,
          padding: 10,
          marginTop: 8,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 8 }}>Agregar referencia</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (https://…)"
            required
            disabled={submitting}
            style={inputStyle}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta (opcional)"
            disabled={submitting}
            style={inputStyle}
          />
          {url && (
            <small style={{ color: 'var(--text)' }}>
              Tipo detectado: <strong>{inferKind(url) || '—'}</strong>
            </small>
          )}
          <button
            type="submit"
            disabled={!url.trim() || submitting}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {submitting ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" style={{ color: '#c44', marginTop: 8, fontSize: '0.9rem' }}>
          {error}
        </p>
      )}
    </section>
  )
}
