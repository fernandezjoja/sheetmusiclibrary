import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { usePageTitle } from '../usePageTitle'

/**
 * Visibility model for the hub's sub-groups (top-to-bottom order):
 *
 *   - Servicios del Ciclo (signed-in only, still placeholder)
 *   - Misterios y otros servicios (signed-in only) — has the Panikhida page
 *   - Calendario Litúrgico (always visible) — Octoechos + Grandes Fiestas
 *   - Todas (always visible) — escape-hatch list of every score.
 *
 * The signed-in gate is content-focus, not content-hide: anonymous visitors
 * can still reach the pages directly via URL. The hub just keeps their view
 * focused on the public-facing categories.
 */
const groupTitleStyle = { margin: '28px 0 8px' } as const
const placeholderStyle = {
  color: 'var(--text)',
  fontStyle: 'italic',
  paddingLeft: 16,
} as const

export default function BibliotecaHub() {
  usePageTitle('Biblioteca')
  const { user } = useAuth()
  const isSignedIn = user !== null
  return (
    <article>
      <h2>Biblioteca</h2>
      <p style={{ color: 'var(--text)' }}>
        Explora por categoría.
      </p>

      {isSignedIn && (
        <>
          <h3 style={groupTitleStyle}>Servicios del Ciclo</h3>
          <p style={placeholderStyle}>(Por añadir)</p>

          <h3 style={groupTitleStyle}>Misterios y otros servicios</h3>

          <Link to="/biblioteca/panikhida" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Panikhida</span>
              <span className="card-link-desc">
                Servicio de conmemoración por los difuntos.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>
        </>
      )}

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
