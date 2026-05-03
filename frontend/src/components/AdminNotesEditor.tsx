import { useState, type FormEvent } from 'react'
import type { ScoreNote } from '../api'

type UpdateParams = { body?: string; sortOrder?: number }

type Props = {
  notes: ScoreNote[]
  onAdd: (body: string) => Promise<void>
  onUpdate: (noteId: number, params: UpdateParams) => Promise<void>
  onDelete: (noteId: number) => Promise<void>
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

const linkBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  lineHeight: 1,
  padding: '0 6px',
}

/**
 * Bullet list of admin-authored notes plus an inline "add note" form.
 * Each note row has Edit + ↑ + ↓ + × actions. Reorder uses simple
 * "set my sortOrder to neighbor's ± 1"; sortOrder values may drift over
 * time but stay within INT range comfortably.
 */
export default function AdminNotesEditor({ notes, onAdd, onUpdate, onDelete }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await onAdd(trimmed)
      setDraft('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (n: ScoreNote) => {
    setEditingId(n.id)
    setEditDraft(n.body)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const saveEdit = async (noteId: number) => {
    const trimmed = editDraft.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await onUpdate(noteId, { body: trimmed })
      setEditingId(null)
      setEditDraft('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const move = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction
    if (target < 0 || target >= notes.length) return
    const me = notes[idx]
    const neighbor = notes[target]
    // Direction -1 (up) → my new sortOrder is strictly less than neighbor's.
    // Direction +1 (down) → strictly greater. Strict inequality wins over
    // the id-secondary tiebreak no matter which way insertion-order pointed.
    const newSortOrder = neighbor.sortOrder + direction
    setBusy(true)
    setError(null)
    try {
      await onUpdate(me.id, { sortOrder: newSortOrder })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (noteId: number) => {
    setBusy(true)
    setError(null)
    try {
      await onDelete(noteId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {notes.length > 0 && (
        <ul
          style={{
            listStyle: 'disc',
            paddingLeft: 20,
            margin: '0 0 6px',
            fontSize: '0.9rem',
            color: 'var(--text)',
          }}
        >
          {notes.map((n, idx) => (
            <li key={n.id} style={{ marginBottom: 3 }}>
              {editingId === n.id ? (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(n.id)
                      else if (e.key === 'Escape') cancelEdit()
                    }}
                    disabled={busy}
                    style={{
                      flex: 1,
                      minWidth: 220,
                      padding: '2px 6px',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      background: 'var(--bg)',
                      color: 'var(--text-h)',
                      font: 'inherit',
                      fontSize: '0.9rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(n.id)}
                    disabled={busy || !editDraft.trim()}
                    style={{ ...linkBtn, color: '#3a8a3a' }}
                    title="Guardar"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={busy}
                    style={{ ...linkBtn, color: 'var(--text)' }}
                    title="Cancelar"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                  <span>{n.body}</span>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={busy || idx === 0}
                    style={arrowBtn}
                    title="Subir"
                    aria-label="Subir nota"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={busy || idx === notes.length - 1}
                    style={arrowBtn}
                    title="Bajar"
                    aria-label="Bajar nota"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(n)}
                    disabled={busy}
                    style={{ ...linkBtn, color: 'var(--text)' }}
                    title="Editar nota"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    disabled={busy}
                    style={{ ...linkBtn, color: '#c44' }}
                    title="Eliminar nota"
                  >
                    ×
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Agregar nota…"
          disabled={busy}
          style={{
            flex: 1,
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
          disabled={busy || !draft.trim()}
          style={{ padding: '4px 10px', fontSize: '0.9rem' }}
        >
          +
        </button>
      </form>
      {error && (
        <p role="alert" style={{ color: '#c44', margin: '4px 0 0', fontSize: '0.85rem' }}>
          {error}
        </p>
      )}
    </div>
  )
}
