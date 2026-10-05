// Widths vary so the placeholder reads as a list of titles, not a grid.
const TITLE_WIDTHS = ['42%', '58%', '35%', '50%', '64%', '40%', '55%', '46%']

/**
 * Placeholder rows shown while the score list loads. Same row height and
 * dividers as ScoreRow, so the page doesn't jump when the list arrives.
 */
export default function ScoreListSkeleton() {
  return (
    <div role="status" aria-label="Cargando partituras">
      <ul className="score-list" aria-hidden="true">
        {TITLE_WIDTHS.map((width, i) => (
          <li key={i} className="score-row">
            <div className="skeleton-bar" style={{ width, height: '1.05em' }} />
            <div
              className="skeleton-bar"
              style={{ width: '28%', height: '0.8em', marginTop: 10 }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
