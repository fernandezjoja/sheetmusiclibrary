import { Link } from 'react-router-dom'

export default function Learn() {
  return (
    <article>
      <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
        Coming soon.
      </p>
      <p>
        <Link to="/">← Home</Link>
      </p>
    </article>
  )
}
