import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Score } from '../api'

export default function ScoresList() {
  const [scores, setScores] = useState<Score[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p role="alert">Error loading scores: {error}</p>
  if (!scores) return <p>Loading…</p>
  if (scores.length === 0) return <p>No scores yet.</p>

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {scores.map((s) => (
        <li key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <Link to={`/scores/${s.id}`}>{s.title}</Link>
          {s.composer && <span> — {s.composer}</span>}
          {s.tags.length > 0 && (
            <span style={{ marginLeft: 12, fontSize: '0.85rem' }}>
              {s.tags.map((t) => `#${t}`).join(' ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
