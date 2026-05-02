import { Link, Outlet, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth'

function App() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">Biblioteca de Música Litúrgica</Link>
        <nav className="app-nav">
          {/* Admin link is intentionally not shown to anonymous viewers — the
              URL is reachable directly, but we don't advertise it. */}
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="app-nav-link">
              Admin
            </Link>
          )}
          {!loading && (
            user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="app-nav-link app-nav-button"
              >
                Sign out ({user.username})
              </button>
            ) : (
              <Link to="/login" className="app-nav-link">
                Sign in
              </Link>
            )
          )}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default App
