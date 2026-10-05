import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, type CurrentUser } from './api'
import { AuthContext, useAuth } from './useAuth'

export type { CurrentUser }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  // On app load, check whether the browser already has a valid session
  // cookie (from a previous "remember me" login).
  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    await api.login(username, password)
    const me = await api.me()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Wraps a route that requires authentication. When `role` is provided, also
 * checks that the user has at least that role (USER or ADMIN). Redirects
 * unauthenticated users to /login (preserving where they came from), and
 * sends already-authenticated-but-wrong-role users to the home page.
 */
export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode
  role?: 'USER' | 'ADMIN'
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p>Cargando…</p>
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (role === 'ADMIN' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
