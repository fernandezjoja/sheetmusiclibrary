import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, type ScoreListItem } from './api'
import { useAuth } from './auth'
import { ScoresContext } from './scores'

/**
 * Holds the score list in memory so the list pages share one `/api/scores`
 * request per session instead of each fetching on every visit.
 *
 * The list is loaded the first time a page asks for it (see
 * `useScores`) and is reused until one of these happens:
 *
 *   - the signed-in user changes. The server returns a different list per
 *     role (unpublished scores, `hasPdf`, `hasMscz`), so a list is only ever shown to
 *     the user it was loaded for.
 *   - `useInvalidateScores` is called after an upload, edit or delete.
 *
 * Nothing is persisted: the list lives in this tab's memory only.
 */
export function ScoresProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [version, setVersion] = useState(0)
  const [requests, setRequests] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; scores: ScoreListItem[] } | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const inFlight = useRef<string | null>(null)

  // Identifies who the list belongs to and which revision of it. Anything
  // stored under a different key is treated as absent.
  const owner = user ? `${user.username}:${user.role}` : 'anonymous'
  const key = `${owner}#${version}`
  const fresh = loaded?.key === key

  useEffect(() => {
    // Wait for the session check, so the first request is made as the right
    // user and isn't thrown away a moment later.
    if (loading || requests === 0 || fresh) return
    if (inFlight.current === key) return
    inFlight.current = key
    api.listScores().then(
      (scores) => {
        // The key moved on (login, logout, invalidation) while this was in
        // the air: drop the response.
        if (inFlight.current !== key) return
        inFlight.current = null
        setLoaded({ key, scores })
        setFailed(null)
      },
      (e: Error) => {
        if (inFlight.current !== key) return
        inFlight.current = null
        setFailed({ key, message: e.message })
      },
    )
  }, [loading, requests, fresh, key])

  const request = useCallback(() => setRequests((n) => n + 1), [])
  const invalidate = useCallback(() => setVersion((v) => v + 1), [])

  const scores = fresh ? loaded.scores : null
  const error = !fresh && failed?.key === key ? failed.message : null

  const value = useMemo(
    () => ({ scores, error, request, invalidate }),
    [scores, error, request, invalidate],
  )

  return <ScoresContext.Provider value={value}>{children}</ScoresContext.Provider>
}
