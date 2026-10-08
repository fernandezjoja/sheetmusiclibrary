import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import { useScores } from '../scores'
import { HOLY_WEEK_DAYS, holyWeekContextTag } from '../semanaSanta'
import { usePageTitle } from '../usePageTitle'

const backLink = (
  <p style={{ marginTop: 24 }}>
    <Link to="/biblioteca">← Volver a la biblioteca</Link>
  </p>
)

/**
 * Lists the Holy Week days that have at least one score. Uses the shared
 * score list, so this costs no request beyond the one the list pages make.
 */
export default function SemanaSantaHub() {
  usePageTitle('Semana Santa y Pascua')
  const { scores, error } = useScores()

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) {
    return (
      <article>
        <h2>Semana Santa y Pascua</h2>
        <ScoreListSkeleton />
      </article>
    )
  }

  const days = HOLY_WEEK_DAYS.filter((day) => {
    const contextTag = holyWeekContextTag(day)
    return scores.some((s) => s.tags.includes(contextTag))
  })

  return (
    <article>
      <h2>Semana Santa y Pascua</h2>
      {days.length === 0 ? (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay piezas de Semana Santa todavía.
        </p>
      ) : (
        <p style={{ color: 'var(--text)', marginTop: -3, marginBottom: 24 }}>
          Cada día con los servicios que se cantan ese día.
        </p>
      )}

      {days.map((day, i) => (
        <Fragment key={day.slug}>
          {/* Pascha is set apart from the Holy Week days before it. */}
          {day.slug === 'pascua' && i > 0 && <hr className="card-separator" />}
          <Link to={`/biblioteca/semanasanta/${day.slug}`} className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">{day.label}</span>
              <span className="card-link-desc">
                {day.services.map((s) => s.label).join(' · ')}
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>
        </Fragment>
      ))}

      {backLink}
    </article>
  )
}
