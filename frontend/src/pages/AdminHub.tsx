import { Link } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'

export default function AdminHub() {
  usePageTitle('Administración')

  return (
    <article>
      <h2>Administración</h2>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ marginTop: 0 }}>Subir</h3>
        <p>Agregar una nueva partitura a la biblioteca.</p>
        <p>
          <Link to="/admin/upload" className="btn-primary">
            + Subir nueva partitura
          </Link>
        </p>
      </section>

      <section>
        <h3>Editar</h3>
        <p>Reemplazar archivos o actualizar los metadatos de una partitura existente.</p>
        {/* No score list here: loading it meant fetching every score on each
            visit. Editing starts from the score's own page instead. */}
        <p>
          Abre la partitura desde la{' '}
          <Link to="/biblioteca/todas">biblioteca</Link> y usa el botón
          «Editar» de su página.
        </p>
      </section>
    </article>
  )
}
