import { useRef, useState, type FormEvent } from 'react'
import { api, type Score } from '../api'
import AdminNotesEditor from './AdminNotesEditor'

type Props = {
  score: Score
  onChange: () => void
}

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

/**
 * Admin-side list of recordings with: per-row inline label edit + remove +
 * audio preview + nested notes editor, plus an inline "add new recording"
 * form below the list. The blob is immutable — to swap the audio, delete
 * and re-add. Only the metadata (label) is editable via PATCH.
 */
export default function AdminRecordingsSection({ score, onChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createRecording(score.id, file, label || null)
      setFile(null)
      setLabel('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (rid: number, displayLabel: string) => {
    if (!window.confirm(`Eliminar la grabación "${displayLabel}"?`)) return
    setError(null)
    try {
      await api.deleteRecording(score.id, rid)
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const startEdit = (rid: number, currentLabel: string) => {
    setEditingId(rid)
    setEditDraft(currentLabel)
    setError(null)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }
  const saveEdit = async (rid: number) => {
    setSubmitting(true)
    setError(null)
    try {
      await api.updateRecording(score.id, rid, { label: editDraft.trim() || null })
      setEditingId(null)
      setEditDraft('')
      onChange()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const move = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction
    if (target < 0 || target >= score.recordings.length) return
    const me = score.recordings[idx]
    const neighbor = score.recordings[target]
    setSubmitting(true)
    setError(null)
    try {
      await api.updateRecording(score.id, me.id, {
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
      <h3 style={{ marginBottom: 12 }}>Grabaciones</h3>
      {score.recordings.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text)', fontStyle: 'italic' }}>
          (ninguna)
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {score.recordings.map((rec, idx) => {
            const display = rec.label || rec.originalFilename || 'Recording'
            const isEditing = editingId === rec.id
            return (
              <li
                key={rec.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  {isEditing ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        gap: 6,
                        alignItems: 'center',
                        flex: 1,
                      }}
                    >
                      <input
                        type="text"
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(rec.id)
                          else if (e.key === 'Escape') cancelEdit()
                        }}
                        disabled={submitting}
                        placeholder="Etiqueta"
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          background: 'var(--bg)',
                          color: 'var(--text-h)',
                          font: 'inherit',
                          fontSize: '0.95rem',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(rec.id)}
                        disabled={submitting}
                        style={{ ...linkBtn, color: '#3a8a3a' }}
                        title="Guardar"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={submitting}
                        style={{ ...linkBtn, color: 'var(--text)' }}
                        title="Cancelar"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <>
                      <strong>{display}</strong>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => move(idx, -1)}
                          disabled={submitting || idx === 0}
                          style={arrowBtn}
                          title="Subir"
                          aria-label="Subir grabación"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(idx, 1)}
                          disabled={submitting || idx === score.recordings.length - 1}
                          style={arrowBtn}
                          title="Bajar"
                          aria-label="Bajar grabación"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(rec.id, rec.label ?? '')}
                          style={{ ...linkBtn, color: 'var(--text)' }}
                          title="Editar etiqueta"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(rec.id, display)}
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
                    </>
                  )}
                </div>
                <audio
                  controls
                  preload="none"
                  src={api.recordingUrl(score.id, rec.id)}
                  style={{ width: '100%' }}
                />
                <AdminNotesEditor
                  notes={rec.notes}
                  onAdd={async (body) => {
                    await api.createRecordingNote(score.id, rec.id, body)
                    onChange()
                  }}
                  onUpdate={async (nid, params) => {
                    await api.updateRecordingNote(score.id, rec.id, nid, params)
                    onChange()
                  }}
                  onDelete={async (nid) => {
                    await api.deleteRecordingNote(score.id, rec.id, nid)
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
        <strong style={{ display: 'block', marginBottom: 8 }}>Agregar grabación</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta (opcional, ej. 'Coro de Pascha 2024')"
            disabled={submitting}
            style={{
              padding: '4px 6px',
              border: '1px solid var(--border)',
              borderRadius: 3,
              background: 'var(--bg)',
              color: 'var(--text-h)',
              font: 'inherit',
              fontSize: '0.9rem',
            }}
          />
          <button
            type="submit"
            disabled={!file || submitting}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {submitting ? 'Subiendo…' : 'Agregar'}
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
