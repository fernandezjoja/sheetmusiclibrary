import { Link, useParams } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import ScoreRow from '../components/ScoreRow'
import { useScores } from '../scores'
import { HOLY_WEEK_DAYS, holyWeekContextTag } from '../semanaSanta'
import { compareByOrder } from '../tags'
import { usePageTitle } from '../usePageTitle'

const backLink = (
  <p style={{ marginTop: 24 }}>
    <Link to="/biblioteca/semanasanta">← Volver a Semana Santa</Link>
  </p>
)

/**
 * One day of Holy Week: its services as headings, in the order they are
 * sung, with that day's scores under each. Which day comes from the URL.
 */
export default function SemanaSantaDay() {
  const { slug } = useParams()
  const day = HOLY_WEEK_DAYS.find((d) => d.slug === slug)
  usePageTitle(day?.label ?? 'Semana Santa y Pascua')
  const { scores, error } = useScores()

  if (!day) {
    return (
      <article>
        <h2>Día no encontrado</h2>
        {backLink}
      </article>
    )
  }
  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) {
    return (
      <article>
        <h2>{day.label}</h2>
        <ScoreListSkeleton />
      </article>
    )
  }

  const contextTag = holyWeekContextTag(day)
  const ofTheDay = scores.filter((s) => s.tags.includes(contextTag)).sort(compareByOrder)

  // A score tagged with two of the day's services shows under both. One that
  // matches none goes in a last group, so nothing tagged for the day is lost.
  const groups: { label: string; pieces: ScoreListItem[] }[] = day.services.map((service) => ({
    label: service.label,
    pieces: ofTheDay.filter((s) => s.tags.includes(service.tag)),
  }))
  const unplaced = ofTheDay.filter((s) => !day.services.some((service) => s.tags.includes(service.tag)))
  if (unplaced.length > 0) groups.push({ label: 'Otras piezas', pieces: unplaced })

  return (
    <article>
      <h2>{day.label}</h2>

      {ofTheDay.length === 0 && (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas etiquetadas con <code>{contextTag}</code> todavía.
        </p>
      )}

      {groups
        .filter((group) => group.pieces.length > 0)
        .map((group) => (
          <section key={group.label} style={{ marginBottom: 8 }}>
            <h3 style={{ margin: '28px 0 6px' }}>{group.label}</h3>
            <ul className="score-list">
              {group.pieces.map((s) => (
                <ScoreRow key={s.id} score={s} />
              ))}
            </ul>
          </section>
        ))}

      {backLink}
    </article>
  )
}
