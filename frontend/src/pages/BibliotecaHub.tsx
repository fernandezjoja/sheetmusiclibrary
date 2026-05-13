import { Link } from 'react-router-dom'

export default function BibliotecaHub() {
  return (
    <article>
      <h2>Biblioteca</h2>
      <p style={{ color: 'var(--text)' }}>
        Explora la colección por categoría.
      </p>

      <section style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '28px 0 6px' }}>Ciclo de Octoechos (8 Tonos)</h3>
        <p>
          Piezas del ciclo dominical del Octoechos, organizadas por tono.
        </p>
        <Link to="/biblioteca/octoechos" className="btn-secondary">
          Ir al ciclo
        </Link>
      </section>

      <section style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '28px 0 6px' }}>Grandes Fiestas</h3>
        <p>
          Las Doce Grandes Fiestas, en orden del año litúrgico.
        </p>
        <Link to="/biblioteca/grandesfiestas" className="btn-secondary">
          Ver fiestas
        </Link>
      </section>

      <section style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '28px 0 6px' }}>Todo</h3>
        <p>
          Lista completa de las partituras en la biblioteca.
        </p>
        <Link to="/biblioteca/todo" className="btn-secondary">
          Ver todo
        </Link>
      </section>
    </article>
  )
}
