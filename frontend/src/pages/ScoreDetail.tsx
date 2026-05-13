import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Score } from '../api'
import { useAuth } from '../auth'
import { usePageTitle } from '../usePageTitle'
import ScorePlayer from '../components/ScorePlayer'
import YouTubeEmbed from '../components/YouTubeEmbed'

export default function ScoreDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [score, setScore] = useState<Score | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  // Bumping `playerKey` remounts <ScorePlayer> with a fresh OSMD instance +
  // engine. Used by:
  //   - the pageshow.persisted listener below (iOS bfcache restore: page
  //     came back from cache, our internal refs may point at stale DOM)
  //   - the manual "Recargar reproductor" link beneath the player
  const [playerKey, setPlayerKey] = useState(0)
  const reloadPlayer = () => setPlayerKey((k) => k + 1)
  usePageTitle(score?.title)

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

  // iOS Safari uses a back-forward cache that can restore this page in a
  // half-state — DOM is back but the OSMD engine's references may point at
  // pre-cache nodes. `pageshow.persisted === true` is the canonical signal
  // that the page came from cache rather than a fresh load; force a remount
  // of the player when that happens.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) reloadPlayer()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  if (error) {
    return (
      <div>
        <p role="alert">{error.status === 404 ? 'Partitura no encontrada.' : `Error: ${error.message}`}</p>
        <Link to="/biblioteca/todo">← Volver a la biblioteca</Link>
      </div>
    )
  }
  if (!score) return <p>Cargando…</p>

  return (
    // Bottom padding clears the fixed playback dock (~150px tall) so the
    // page's last elements — recordings, references, back link — can scroll
    // out from underneath it instead of being permanently obscured.
    <article style={{ paddingBottom: 220 }}>
      <h2 style={{ marginBottom: 4, textAlign: 'center' }}>
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
            title="Versión de prueba — visible solo para usuarios autenticados"
          >
            PRUEBA
          </span>
        )}
      </h2>
      {score.composer && <p style={{ marginTop: 0, color: 'var(--text)' }}>{score.composer}</p>}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          margin: '16px 0',
          alignItems: 'center',
        }}
      >
        {score.pdfPath && (
          <a
            href={api.pdfUrl(score.id)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Descargar PDF
          </a>
        )}
        {score.hasMscz && (
          <a
            href={api.msczUrl(score.id)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            Descargar .mscz
          </a>
        )}
        {user?.role === 'ADMIN' && (
          <Link
            to={`/admin/edit/${score.id}`}
            className="btn-secondary"
            style={{ marginLeft: 'auto' }}
          >
            Editar
          </Link>
        )}
      </div>

      {score.musicxmlPath ? (
        <>
          <aside
            role="note"
            style={{
              margin: '0 0 16px',
              padding: '12px 16px',
              background: '#fff8e6',
              border: '1px solid #f5e6c8',
              borderLeft: '4px solid #d8a93b',
              borderRadius: 4,
              color: '#5c4a1a',
              fontSize: '0.9rem',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 6 }}>
              Sobre el reproductor
            </strong>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>
                El motor de reproducción interpreta cada nota tal como se
                muestra en la partitura. Cuando varios versos se cantan
                secuencialmente sobre una misma nota durante un tramo largo,
                ese tramo suena como una única nota sostenida — no como las
                sílabas individuales.
              </li>
              <li style={{ marginBottom: 4 }}>
                El reproductor da una <em>idea general</em> de cómo debería
                sonar la música, no es una representación exacta de la partitura oficial. Los tempos (♩=N) que aparecen sobre el
                pentagrama son una <em>recomendación</em> — no figuran en el
                PDF y no son una regla estricta. Los tiempos exactos pueden
                variar respecto a la interpretación real de un coro — en el
                caso que haya, puedes consultar las <strong>grabaciones</strong>{' '}
                más abajo para una referencia más fiel.
              </li>
              <li>
                El comportamiento puede variar según el navegador. Disculpa
                cualquier irregularidad — es una versión temprana.
              </li>
            </ul>
          </aside>
          <ScorePlayer key={playerKey} url={api.musicxmlUrl(score.id)} />
          <p
            style={{
              marginTop: 12,
              fontSize: '0.85rem',
              color: 'var(--text)',
              textAlign: 'right',
            }}
          >
            ¿El reproductor no responde?{' '}
            <button
              type="button"
              onClick={reloadPlayer}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                color: 'var(--accent)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Recargar
            </button>
            .
          </p>
        </>
      ) : (
        <p style={{ fontStyle: 'italic', color: 'var(--text)' }}>
          Esta partitura no tiene MusicXML adjunto.
        </p>
      )}

      {score.recordings.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Grabaciones</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {score.recordings.map((rec) => (
              <li key={rec.id} style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>{rec.label || rec.originalFilename || 'Grabación'}</strong>
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
        <Link to="/biblioteca/todo">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
