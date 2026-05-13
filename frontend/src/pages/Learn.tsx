import { Link } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'

export default function Learn() {
  usePageTitle('Aprender')
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
