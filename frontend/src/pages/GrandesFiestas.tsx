import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ScoreListItem } from '../api'
import {
  attributionParts,
  freeFormTags,
  liturgicalRoleParts,
} from '../tags'
import { usePageTitle } from '../usePageTitle'

/**
 * The Twelve Great Feasts in liturgical-year order (Sept → Aug, starting with
 * the Nativity of the Theotokos). Pascha sits at position 13 — outside the
 * Twelve as the "Feast of Feasts."
 *
 * Each entry lists the `context:` tag values that count as that feast; the
 * first feast whose alias matches "owns" the score. Aliases (e.g. legacy
 * `context:pascha` vs current `context:pascua`) are deduped so a score with
 * both tags still appears once.
 */
type Feast = {
  position: number
  contextTags: string[]
  label: string
}

const FEASTS: Feast[] = [
  { position: 1, contextTags: ['context:natividad-theotokos'], label: 'Natividad de la Theotokos' },
  { position: 2, contextTags: ['context:exaltacion-cruz'], label: 'Exaltación de la Cruz' },
  { position: 3, contextTags: ['context:presentacion-theotokos'], label: 'Presentación de la Theotokos' },
  { position: 4, contextTags: ['context:natividad-senor'], label: 'Natividad del Señor' },
  { position: 5, contextTags: ['context:teofania'], label: 'Teofanía' },
  { position: 6, contextTags: ['context:encuentro-senor'], label: 'Encuentro del Señor' },
  { position: 7, contextTags: ['context:anunciacion'], label: 'Anunciación' },
  { position: 8, contextTags: ['context:domingo-de-ramos'], label: 'Domingo de Ramos' },
  { position: 9, contextTags: ['context:ascension'], label: 'Ascensión' },
  { position: 10, contextTags: ['context:pentecostes'], label: 'Pentecostés' },
  { position: 11, contextTags: ['context:transfiguracion'], label: 'Transfiguración' },
  { position: 12, contextTags: ['context:dormicion'], label: 'Dormición de la Theotokos' },
  { position: 13, contextTags: ['context:pascua'], label: 'Pascua' },
]

// Within each feast, sort by piece type using the same priority as the
// Octoechos page. Anything unmatched lands at the bottom of its feast group
// rather than disappearing.
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

function scoreBelongsTo(score: ScoreListItem, feast: Feast): boolean {
  return feast.contextTags.some((c) => score.tags.includes(c))
}

export default function GrandesFiestas() {
  usePageTitle('Grandes Fiestas')
  const [scores, setScores] = useState<ScoreListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) return <p>Cargando…</p>

  // Bucket scores per feast. A score with multiple feast contexts (e.g. the
  // Trisagion-substitute "Cuantos Habéis Sido Bautizados", tagged with several
  // contexts) appears in each of its feast sections — intentional, since it's
  // legitimately sung at each of those feasts.
  const buckets: { feast: Feast; pieces: ScoreListItem[] }[] = FEASTS.map((feast) => ({
    feast,
    pieces: scores
      .filter((s) => scoreBelongsTo(s, feast))
      .sort((a, b) => {
        const p = pieceTypePriority(a) - pieceTypePriority(b)
        if (p !== 0) return p
        return a.title.localeCompare(b.title, 'es')
      }),
  }))

  return (
    <article>
      <h2>Grandes Fiestas</h2>
      <p style={{ color: 'var(--text)' }}>
        Las Doce Grandes Fiestas, en orden del año litúrgico (1 = Natividad de
        la Theotokos, 12 = Dormición) y Pascua al final como Fiesta de
        Fiestas.
      </p>

      {buckets.map(({ feast, pieces }) => (
        <section key={feast.position} style={{ marginBottom: 8 }}>
          <h3 style={{ margin: '28px 0 6px' }}>
            {feast.position}. {feast.label}
          </h3>
          {pieces.length === 0 ? (
            <p
              style={{
                color: 'var(--text)',
                fontStyle: 'italic',
                fontSize: '0.9rem',
              }}
            >
              (sin piezas)
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pieces.map((s) => {
                const attribution = attributionParts(s)
                const liturgical = liturgicalRoleParts(s)
                const freeForm = freeFormTags(s)
                const hasSecondaryLine =
                  liturgical.length > 0 || freeForm.length > 0

                return (
                  <li
                    key={`${feast.position}-${s.id}`}
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
          )}
        </section>
      ))}

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
