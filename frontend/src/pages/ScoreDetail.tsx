import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Score } from '../api'
import ScorePlayer from '../components/ScorePlayer'

export default function ScoreDetail() {
  const { id } = useParams<{ id: string }>()
  const [score, setScore] = useState<Score | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)

  useEffect(() => {
    if (!id) return
    setScore(null)
    setError(null)
    api
      .getScore(id)
      .then(setScore)
      .catch((e: Error & { status?: number }) =>
        setError({ message: e.message, status: e.status }),
      )
  }, [id])

  if (error) {
    return (
      <div>
        <p role="alert">{error.status === 404 ? 'Score not found.' : `Error: ${error.message}`}</p>
        <Link to="/biblioteca">← Back to all scores</Link>
      </div>
    )
  }
  if (!score) return <p>Loading…</p>

  return (
    <article>
      <h2 style={{ marginBottom: 4 }}>{score.title}</h2>
      {score.composer && <p style={{ marginTop: 0, color: 'var(--text)' }}>{score.composer}</p>}
      {score.tags.length > 0 && (
        <p style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
          {score.tags.map((t) => `#${t}`).join(' ')}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        {score.pdfPath && (
          <a href={api.pdfUrl(score.id)} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        )}
      </div>

      {score.musicxmlPath ? (
        <ScorePlayer url={api.musicxmlUrl(score.id)} />
      ) : (
        <p style={{ fontStyle: 'italic', color: 'var(--text)' }}>
          No MusicXML attached to this score.
        </p>
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Back to all scores</Link>
      </p>
    </article>
  )
}
