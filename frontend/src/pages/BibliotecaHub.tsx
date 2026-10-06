import { Link } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { usePageTitle } from '../usePageTitle'

/**
 * Visibility model for the hub's sub-groups (top-to-bottom order):
 *
 *   - Año Litúrgico (always visible) — Octoechos + Grandes Fiestas
 *   - Servicios del Ciclo (signed-in only) — Divina Liturgia + Vísperas Mayores
 *   - Misterios y otros servicios (signed-in only) — Bautismo y Crismación,
 *     Matrimonio, Panikhida
 *   - Semana Santa y Pascua (signed-in only, still placeholder)
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
const separatorStyle = {
  width: 192,
  margin: '14px auto',
  border: 0,
  borderTop: '1px solid var(--border)',
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

      <h3 style={groupTitleStyle}>Año Litúrgico</h3>

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

      {isSignedIn && (
        <>
          <h3 style={groupTitleStyle}>Servicios del Ciclo</h3>

          <Link to="/biblioteca/divinaliturgia" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Divina Liturgia</span>
              <span className="card-link-desc">
                Liturgia eucarística.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>

          <hr style={separatorStyle} />

          <Link to="/biblioteca/visperasmayores" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Vísperas Mayores</span>
              <span className="card-link-desc">
                Servicio vespertino.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>

          <h3 style={groupTitleStyle}>Misterios y otros servicios</h3>

          <Link to="/biblioteca/bautismo" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Bautismo y Crismación</span>
              <span className="card-link-desc">
                Sacramentos de iniciación.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>

          <Link to="/biblioteca/matrimonio" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Matrimonio</span>
              <span className="card-link-desc">
                Sacramento del matrimonio.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>

          <Link to="/biblioteca/panikhida" className="card-link">
            <span className="card-link-body">
              <span className="card-link-title">Panikhida</span>
              <span className="card-link-desc">
                Servicio de conmemoración por los difuntos.
              </span>
            </span>
            <span className="card-link-arrow" aria-hidden="true">→</span>
          </Link>

          <h3 style={groupTitleStyle}>Semana Santa y Pascua</h3>
          <p style={placeholderStyle}>(Por añadir)</p>
        </>
      )}

      <Link to="/biblioteca/todas" className="card-link" style={{ marginTop: 28 }}>
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
