import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Score } from '../api'

export default function AdminHub() {
  const [scores, setScores] = useState<Score[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  return (
    <article>
      <h2>Admin</h2>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginTop: 0 }}>Upload</h3>
        <p>Add a new score to the library.</p>
        <p>
          <Link to="/admin/upload">→ Upload a new score</Link>
        </p>
      </section>

      <section>
        <h3>Edit</h3>
        <p>Replace files or update the metadata of an existing score.</p>

        {error && <p role="alert">Error loading scores: {error}</p>}
        {!scores && !error && <p>Loading…</p>}
        {scores && scores.length === 0 && (
          <p style={{ color: 'var(--text)' }}>
            No scores yet — upload one first.
          </p>
        )}
        {scores && scores.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {scores.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <span>
                  {s.title}
                  {s.composer && (
                    <span style={{ marginLeft: 6 }}>— {s.composer}</span>
                  )}
                </span>
                <Link to={`/admin/edit/${s.id}`}>Edit</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
