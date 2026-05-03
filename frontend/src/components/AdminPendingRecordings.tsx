import { useRef, useState, type FormEvent } from 'react'
import type { CreateRecordingDraft } from '../api'

type Props = {
  pending: CreateRecordingDraft[]
  onAdd: (draft: CreateRecordingDraft) => void
  onRemove: (index: number) => void
  disabled?: boolean
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

/**
 * Build-up list of recordings to attach atomically with a new score. Each draft
 * holds a File + optional label + optional notes (one per textarea line).
 * On submit, AdminUpload sends the whole list in a single POST.
 */
export default function AdminPendingRecordings({ pending, onAdd, onRemove, disabled }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState('')
  const [notesRaw, setNotesRaw] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    const notes = notesRaw
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    onAdd({
      file,
      label: label.trim() || null,
      notes,
    })
    setFile(null)
    setLabel('')
    setNotesRaw('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>
        Grabaciones <span style={{ color: 'var(--text)', fontWeight: 'normal' }}>(opcional)</span>
      </h3>
      {pending.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
          {pending.map((r, idx) => (
            <li
              key={idx}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
                fontSize: '0.9rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>
                  <strong>{r.label || r.file.name}</strong>{' '}
                  <span style={{ color: 'var(--text)' }}>
                    ({r.file.name}, {r.notes.length}{' '}
                    {r.notes.length === 1 ? 'nota' : 'notas'})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  disabled={disabled}
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
                  Quitar
                </button>
              </div>
              {r.notes.length > 0 && (
                <ul
                  style={{
                    listStyle: 'disc',
                    paddingLeft: 20,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                  }}
                >
                  {r.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleAdd}
        style={{
          border: '1px dashed var(--border)',
          borderRadius: 4,
          padding: 10,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 8 }}>Agregar grabación</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={disabled}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta (opcional)"
            disabled={disabled}
            style={inputStyle}
          />
          <textarea
            value={notesRaw}
            onChange={(e) => setNotesRaw(e.target.value)}
            placeholder="Notas (opcional, una por línea)"
            rows={2}
            disabled={disabled}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button
            type="submit"
            disabled={!file || disabled}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Agregar a la lista
          </button>
        </div>
      </form>
    </section>
  )
}
