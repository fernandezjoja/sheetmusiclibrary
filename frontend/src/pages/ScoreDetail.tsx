import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Score } from '../api'
import ScorePlayer from '../components/ScorePlayer'
import YouTubeEmbed from '../components/YouTubeEmbed'

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
      <h2 style={{ marginBottom: 4 }}>
        {score.title}
        {!score.published && (
          <span
            style={{
              marginLeft: 10,
              fontSize: '0.7em',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#f5e6c8',
              color: '#8a5a00',
              verticalAlign: 'middle',
            }}
            title="Test version — visible only to signed-in users"
          >
            TEST
          </span>
        )}
      </h2>
      {score.composer && <p style={{ marginTop: 0, color: 'var(--text)' }}>{score.composer}</p>}

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

      {score.recordings.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Grabaciones</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {score.recordings.map((rec) => (
              <li key={rec.id} style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>{rec.label || rec.originalFilename || 'Recording'}</strong>
                </div>
                <audio
                  controls
                  preload="none"
                  src={api.recordingUrl(score.id, rec.id)}
                  style={{ width: '100%', maxWidth: 480 }}
                />
                {rec.notes.length > 0 && (
                  <ul
                    style={{
                      marginTop: 6,
                      marginBottom: 0,
                      paddingLeft: 20,
                      fontSize: '0.9rem',
                      color: 'var(--text)',
                    }}
                  >
                    {rec.notes.map((n) => (
                      <li key={n.id}>{n.body}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {score.references.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Referencias</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {score.references.map((ref) => (
              <li key={ref.id} style={{ marginBottom: 16 }}>
                {ref.kind === 'youtube' ? (
                  <>
                    <YouTubeEmbed url={ref.url} title={ref.label ?? 'YouTube'} />
                    {ref.label && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.95rem' }}>
                        {ref.label}
                      </p>
                    )}
                  </>
                ) : (
                  <a href={ref.url} target="_blank" rel="noreferrer">
                    {ref.label || ref.url}
                  </a>
                )}
                {ref.notes.length > 0 && (
                  <ul
                    style={{
                      marginTop: 4,
                      marginBottom: 0,
                      paddingLeft: 20,
                      fontSize: '0.9rem',
                      color: 'var(--text)',
                    }}
                  >
                    {ref.notes.map((n) => (
                      <li key={n.id}>{n.body}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Back to all scores</Link>
      </p>
    </article>
  )
}
