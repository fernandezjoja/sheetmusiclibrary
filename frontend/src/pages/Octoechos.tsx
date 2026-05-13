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

// Piece-type priority within each tone. The list order IS the display order:
//   1) Tropario   → service:tropario
//   2) Contaquio  → service:contaquio
//   3) Proquímeno → slot:proquimeno
//   4) Aleluya    → slot:aleluya
// Anything else gets pushed to the bottom of its tone group (priority Infinity)
// so unexpected pieces still show up rather than silently disappearing.
const PIECE_TYPE_MATCHERS: ((s: ScoreListItem) => boolean)[] = [
  (s) => s.tags.includes('service:tropario'),
  (s) => s.tags.includes('service:contaquio'),
  (s) => s.tags.includes('slot:proquimeno'),
  (s) => s.tags.includes('slot:aleluya'),
]

function pieceTypePriority(score: ScoreListItem): number {
  const idx = PIECE_TYPE_MATCHERS.findIndex((match) => match(score))
  return idx === -1 ? Number.POSITIVE_INFINITY : idx
}

function toneNumber(score: ScoreListItem): number {
  const tag = findTag(score.tags, 'tone:')
  if (!tag) return Number.POSITIVE_INFINITY
  const n = parseInt(tag.slice('tone:'.length), 10)
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
}

export default function Octoechos() {
  usePageTitle('Octoechos')
  const [scores, setScores] = useState<ScoreListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) return <p>Cargando…</p>

  // Filter, then sort by (tone, piece-type, title).
  const octoechos = scores
    .filter((s) => s.tags.includes('cycle:octoechos'))
    .sort((a, b) => {
      const t = toneNumber(a) - toneNumber(b)
      if (t !== 0) return t
      const p = pieceTypePriority(a) - pieceTypePriority(b)
      if (p !== 0) return p
      return a.title.localeCompare(b.title, 'es')
    })

  if (octoechos.length === 0) {
    return (
      <article>
        <h2>Ciclo de Octoechos (8 Tonos)</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas etiquetadas con <code>cycle:octoechos</code> todavía.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link to="/biblioteca">← Volver a la biblioteca</Link>
        </p>
      </article>
    )
  }

  // Group by tone for visual rendering. The sort above guarantees the order
  // *within* each tone is already correct (Tropario → Aleluya).
  const byTone = new Map<number, ScoreListItem[]>()
  for (const s of octoechos) {
    const tone = toneNumber(s)
    if (!byTone.has(tone)) byTone.set(tone, [])
    byTone.get(tone)!.push(s)
  }
  const sortedTones = [...byTone.keys()].sort((a, b) => a - b)

  return (
    <article>
      <h2>Ciclo de Octoechos (8 Tonos)</h2>
      <p style={{ color: 'var(--text)' }}>
        Piezas del ciclo dominical, agrupadas por tono. Dentro de cada tono:
        Tropario, Contaquio, Proquímeno, Aleluya.
      </p>

      {sortedTones.map((tone) => (
        <section key={tone} style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '28px 0 6px' }}>
            {Number.isFinite(tone) ? `Tono ${tone}` : 'Sin tono'}
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {byTone.get(tone)!.map((s) => {
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
                    <Link
                      to={`/scores/${s.id}`}
                      style={{ fontWeight: 500 }}
                    >
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
        </section>
      ))}

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
