import { useState, type FormEvent } from 'react'
import type { CreateReferenceDraft } from '../api'

type Props = {
  pending: CreateReferenceDraft[]
  onAdd: (draft: CreateReferenceDraft) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/i

const inputStyle = {
  padding: '4px 6px',
  border: '1px solid var(--border)',
  borderRadius: 3,
  background: 'var(--bg)',
  color: 'var(--text-h)',
  font: 'inherit',
  fontSize: '0.9rem',
}

function inferKind(url: string): string {
  if (!url) return ''
  return YOUTUBE_RE.test(url) ? 'youtube' : 'web'
}

export default function AdminPendingReferences({ pending, onAdd, onRemove, disabled }: Props) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [notesRaw, setNotesRaw] = useState('')

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    const notes = notesRaw
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    onAdd({
      url: trimmedUrl,
      label: label.trim() || null,
      kind: inferKind(trimmedUrl) || null,
      notes,
    })
    setUrl('')
    setLabel('')
    setNotesRaw('')
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>
        Referencias <span style={{ color: 'var(--text)', fontWeight: 'normal' }}>(opcional)</span>
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
                <span style={{ flex: 1, wordBreak: 'break-all' }}>
                  <strong>{r.label || r.url}</strong>
                  {r.kind && (
                    <small style={{ color: 'var(--text)', marginLeft: 6 }}>
                      ({r.kind})
                    </small>
                  )}{' '}
                  <span style={{ color: 'var(--text)' }}>
                    — {r.notes.length} {r.notes.length === 1 ? 'nota' : 'notas'}
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
                    flexShrink: 0,
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
        <strong style={{ display: 'block', marginBottom: 8 }}>Agregar referencia</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (https://…)"
            disabled={disabled}
            style={inputStyle}
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
          {url && (
            <small style={{ color: 'var(--text)' }}>
              Tipo detectado: <strong>{inferKind(url) || '—'}</strong>
            </small>
          )}
          <button
            type="submit"
            disabled={!url.trim() || disabled}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Agregar a la lista
          </button>
        </div>
      </form>
    </section>
  )
}
