import { Link } from 'react-router-dom'
import logoSymbol from '../assets/logo-symbol.svg'
import { useAuth } from '../useAuth'
import { usePageTitle } from '../usePageTitle'

/**
 * Public landing page. Shows only the name and the login button, so anonymous
 * visitors learn nothing about what is behind the login.
 */
export default function Home() {
  usePageTitle()
  const { user, loading } = useAuth()
  return (
    <article className="home">
      <img src={logoSymbol} alt="" className="home-logo" />
      <h1 className="home-name">Kliros</h1>
      <p className="home-desc">Música Litúrgica Ortodoxa</p>
      {!loading && !user && (
        <Link to="/login" className="btn-primary home-login">
          Iniciar sesión
        </Link>
      )}
    </article>
  )
}
