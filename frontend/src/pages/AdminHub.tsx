import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Score } from '../api'

export default function AdminHub() {
  const [scores, setScores] = useState<Score[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listScores().then(setScores).catch((e: Error) => setError(e.message))
  }, [])

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

        {error && <p role="alert">Error al cargar las partituras: {error}</p>}
        {!scores && !error && <p>Cargando…</p>}
        {scores && scores.length === 0 && (
          <p style={{ color: 'var(--text)' }}>
            No hay partituras todavía — sube una primero.
          </p>
        )}
        {scores && scores.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {scores.map((s) => (
              <li
                key={s.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <span>
                  {s.title}
                  {!s.published && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: '0.7em',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: '#f5e6c8',
                        color: '#8a5a00',
                        verticalAlign: 'middle',
                      }}
                      title="Versión de prueba — visible solo para usuarios autenticados"
                    >
                      TEST
                    </span>
                  )}
                  {s.composer && (
                    <span style={{ marginLeft: 6 }}>— {s.composer}</span>
                  )}
                </span>
                <Link to={`/admin/edit/${s.id}`}>Editar</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
