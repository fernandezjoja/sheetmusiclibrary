import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ScoreListItem } from '../api'
import {
  attributionParts,
  findTag,
  freeFormTags,
  liturgicalRoleParts,
} from '../tags'
import { usePageTitle } from '../usePageTitle'

/**
 * Sort key from the `order:NNN` tag. 3-digit zero-padded by convention, but
 * we parse to int and sort numerically so a missing pad doesn't break order.
 * Missing/invalid `order:` lands at the end.
 */
function orderOf(score: ScoreListItem): number {
  const tag = findTag(score.tags, 'order:')
  if (!tag) return Number.POSITIVE_INFINITY
  const n = parseInt(tag.slice('order:'.length), 10)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

export default function Matrimonio() {
  usePageTitle('Matrimonio')
  const [scores, setScores] = useState<ScoreListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) return <p>Cargando…</p>

  // Filter to scores tagged with service:matrimonio, then sort by liturgical
  // order with a title-tiebreaker.
  const items = scores
    .filter((s) => s.tags.includes('service:matrimonio'))
    .sort((a, b) => {
      const o = orderOf(a) - orderOf(b)
      if (o !== 0) return o
      return a.title.localeCompare(b.title, 'es')
    })

  if (items.length === 0) {
    return (
      <article>
        <h2>Matrimonio</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas etiquetadas con <code>service:matrimonio</code> todavía.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link to="/biblioteca">← Volver a la biblioteca</Link>
        </p>
      </article>
    )
  }

  return (
    <article>
      <h2>Matrimonio</h2>
      <p style={{ color: 'var(--text)' }}>
        Sacramento del matrimonio. Piezas en orden litúrgico.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
        {items.map((s) => {
          const attribution = attributionParts(s)
          const liturgical = liturgicalRoleParts(s)
          const freeForm = freeFormTags(s)
          const hasSecondaryLine =
            liturgical.length > 0 || freeForm.length > 0

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
                      PRUEBA
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

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
