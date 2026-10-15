import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import { findTag } from '../tags'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import ScoreRow from '../components/ScoreRow'
import { useScores } from '../scores'
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
  const { scores, error } = useScores()

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) {
    return (
      <article>
        <h2>Ciclo de Octoechos (8 Tonos)</h2>
        <ScoreListSkeleton />
      </article>
    )
  }

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
          <ul className="score-list">
            {byTone.get(tone)!.map((s) => (
              <ScoreRow key={s.id} score={s} />
            ))}
          </ul>
        </section>
      ))}

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
