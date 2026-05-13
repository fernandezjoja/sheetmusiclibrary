import { Link } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'

/**
 * Flip to `true` to reveal the "Servicios del Ciclo" and "Misterios y otros
 * servicios" groups as `(Por añadir)` placeholders. Kept off until those
 * subpages actually have items, to avoid an empty-feeling Biblioteca page.
 * The full group JSX stays in place either way so wiring real items in later
 * is just a matter of replacing the placeholder block — and turning the flag
 * back on is one keystroke.
 */
const SHOW_PLACEHOLDER_GROUPS = false

const groupTitleStyle = { margin: '28px 0 8px' } as const
const placeholderStyle = {
  color: 'var(--text)',
  fontStyle: 'italic',
  paddingLeft: 16,
} as const

export default function BibliotecaHub() {
  usePageTitle('Biblioteca')
  return (
    <article>
      <h2>Biblioteca</h2>
      <p style={{ color: 'var(--text)' }}>
        Explora la colección por categoría.
      </p>

      <h3 style={groupTitleStyle}>Calendario Litúrgico</h3>

      <Link to="/biblioteca/octoechos" className="card-link">
        <span className="card-link-body">
          <span className="card-link-title">Octoechos (8 Tonos)</span>
          <span className="card-link-desc">
            Piezas del ciclo dominical, organizadas por tono.
          </span>
        </span>
        <span className="card-link-arrow" aria-hidden="true">→</span>
      </Link>

      <Link to="/biblioteca/grandesfiestas" className="card-link">
        <span className="card-link-body">
          <span className="card-link-title">Grandes Fiestas</span>
          <span className="card-link-desc">
            Las Doce Grandes Fiestas, en orden del año litúrgico.
          </span>
        </span>
        <span className="card-link-arrow" aria-hidden="true">→</span>
      </Link>

      {SHOW_PLACEHOLDER_GROUPS && (
        <>
          <h3 style={groupTitleStyle}>Servicios del Ciclo</h3>
          <p style={placeholderStyle}>(Por añadir)</p>

          <h3 style={groupTitleStyle}>Misterios y otros servicios</h3>
          <p style={placeholderStyle}>(Por añadir)</p>
        </>
      )}

      <Link to="/biblioteca/todo" className="card-link" style={{ marginTop: 28 }}>
        <span className="card-link-body">
          <span className="card-link-title">Todas las partituras</span>
          <span className="card-link-desc">
            Lista completa de la biblioteca.
          </span>
        </span>
        <span className="card-link-arrow" aria-hidden="true">→</span>
      </Link>
    </article>
  )
}
