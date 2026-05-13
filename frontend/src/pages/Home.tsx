import { Link } from 'react-router-dom'
import { usePageTitle } from '../usePageTitle'

export default function Home() {
  usePageTitle()
  return (
    <article>
      <p>
        <Link to="/biblioteca">→ Ir a la biblioteca</Link>
      </p>
    </article>
  )
}
