import { Link } from 'react-router-dom'

export default function Learn() {
  return (
    <article>
      <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
        Próximamente.
      </p>
      <p>
        <Link to="/">← Inicio</Link>
      </p>
    </article>
  )
}
