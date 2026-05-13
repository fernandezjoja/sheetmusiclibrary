import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ScoreListItem } from '../api'
import {
  attributionParts,
  freeFormTags,
  liturgicalRoleParts,
} from '../tags'
import { usePageTitle } from '../usePageTitle'

export default function ScoresList() {
  usePageTitle('Todas las partituras')
  const [scores, setScores] = useState<ScoreListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) return <p>Cargando…</p>
  if (scores.length === 0) return <p>No hay partituras todavía.</p>

  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {scores.map((s) => {
        const attribution = attributionParts(s)
        const liturgical = liturgicalRoleParts(s)
        const freeForm = freeFormTags(s)
        const hasSecondaryLine = liturgical.length > 0 || freeForm.length > 0

        return (
          <li
            key={s.id}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <Link to={`/scores/${s.id}`} style={{ fontWeight: 500 }}>
                {s.title}
                {!s.published && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: '0.7em',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: '#f5e6c8',
                      color: '#8a5a00',
                      verticalAlign: 'middle',
                    }}
                    title="Versión de prueba — visible solo para usuarios autenticados"
                  >
                    TEST
                  </span>
                )}
              </Link>
              {attribution.length > 0 && (
                <span
                  style={{
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    textAlign: 'right',
                  }}
                >
                  {attribution.join(' · ')}
                </span>
              )}
            </div>
            {hasSecondaryLine && (
              <div
                style={{
                  marginTop: 4,
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                }}
              >
                {liturgical.length > 0 && liturgical.join(' · ')}
                {liturgical.length > 0 && freeForm.length > 0 && ' · '}
                {freeForm.length > 0 &&
                  freeForm.map((t) => `#${t}`).join(' ')}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
