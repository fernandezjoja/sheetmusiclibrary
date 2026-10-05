import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import { findTag } from '../tags'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import ScoreRow from '../components/ScoreRow'
import { useScores } from '../scores'
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

type ServicePageProps = {
  title: string
  /** Full tag to filter by, e.g. `service:panikhida`. */
  tag: string
  description: string
  /**
   * Hide the pieces that change with the day: anything with a `context:` tag
   * other than `context:default`, plus Proquímenos and Aleluyas. Leaves only
   * the fixed parts of the service.
   */
  ordinaryOnly?: boolean
}

function changesWithTheDay(score: ScoreListItem): boolean {
  return score.tags.some(
    (t) =>
      (t.startsWith('context:') && t !== 'context:default') ||
      t === 'slot:proquimeno' ||
      t === 'slot:aleluya',
  )
}

/**
 * Listing page for one service: every score carrying `tag`, in liturgical
 * order. A score can carry several `service:` tags (see TAGS_REF.md), so the
 * same piece may appear on more than one service page.
 */
export default function ServicePage({
  title,
  tag,
  description,
  ordinaryOnly = false,
}: ServicePageProps) {
  usePageTitle(title)
  const { scores, error } = useScores()

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) {
    return (
      <article>
        <h2>{title}</h2>
        <ScoreListSkeleton />
      </article>
    )
  }

  // Filter to scores carrying the tag, then sort by liturgical
  // order with a title-tiebreaker.
  const items = scores
    .filter((s) => s.tags.includes(tag))
    .filter((s) => !ordinaryOnly || !changesWithTheDay(s))
    .sort((a, b) => {
      const o = orderOf(a) - orderOf(b)
      if (o !== 0) return o
      return a.title.localeCompare(b.title, 'es')
    })

  if (items.length === 0) {
    return (
      <article>
        <h2>{title}</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas etiquetadas con <code>{tag}</code> todavía.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link to="/biblioteca">← Volver a la biblioteca</Link>
        </p>
      </article>
    )
  }

  return (
    <article>
      <h2>{title}</h2>
      <p style={{ color: 'var(--text)' }}>
        {description} Piezas en orden litúrgico.
      </p>

      <ul className="score-list" style={{ marginTop: 16 }}>
        {items.map((s) => (
          <ScoreRow key={s.id} score={s} />
        ))}
      </ul>

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
