import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import {
  attributionParts,
  freeFormTags,
  liturgicalRoleParts,
} from '../tags'

/**
 * One score in a listing, rendered as an `<li>`: the title (linked to the
 * score page, with a PRUEBA badge when unpublished), the attribution on the
 * right, and a second line with the liturgical role and free-form tags.
 * Styles are the `.score-row*` rules in index.css.
 */
export default function ScoreRow({ score }: { score: ScoreListItem }) {
  const attribution = attributionParts(score)
  const liturgical = liturgicalRoleParts(score)
  const freeForm = freeFormTags(score)

  return (
    <li className="score-row">
      <div className="score-row-main">
        <Link to={`/scores/${score.id}`} className="score-row-title">
          {score.title}
          {!score.published && (
            <span
              className="score-row-badge"
              title="Versión de prueba — visible solo para usuarios autenticados"
            >
              PRUEBA
            </span>
          )}
        </Link>
        {attribution.length > 0 && (
          <span className="score-row-attribution">{attribution.join(' · ')}</span>
        )}
      </div>
      {(liturgical.length > 0 || freeForm.length > 0) && (
        <div className="score-row-meta">
          {[...liturgical, freeForm.map((t) => `#${t}`).join(' ')]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </li>
  )
}
