import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <article>
      <p>
        <Link to="/biblioteca">→ Browse the library</Link>
      </p>
    </article>
  )
}
