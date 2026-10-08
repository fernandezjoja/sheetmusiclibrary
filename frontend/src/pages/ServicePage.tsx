import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import { compareByOrder } from '../tags'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import ScoreRow from '../components/ScoreRow'
import { useScores } from '../scores'
import { usePageTitle } from '../usePageTitle'

type ServicePageProps = {
  title: string
  /** Full tags to filter by, e.g. `service:panikhida`. A score with any of them is listed. */
  tags: string[]
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
  tags,
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

  // Filter to scores carrying one of the tags, then sort by liturgical
  // order with a title-tiebreaker.
  const items = scores
    .filter((s) => tags.some((tag) => s.tags.includes(tag)))
    .filter((s) => !ordinaryOnly || !changesWithTheDay(s))
    .sort(compareByOrder)

  if (items.length === 0) {
    return (
      <article>
        <h2>{title}</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas etiquetadas con <code>{tags.join(' / ')}</code> todavía.
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
