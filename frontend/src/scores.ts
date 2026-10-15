import { createContext, useContext, useEffect } from 'react'
import type { ScoreListItem } from './api'

export type ScoresState = {
  scores: ScoreListItem[] | null
  error: string | null
  request: () => void
  invalidate: () => void
}

/** Provided by `ScoresProvider`, which owns the fetching and caching. */
export const ScoresContext = createContext<ScoresState | undefined>(undefined)

function useScoresContext(): ScoresState {
  const ctx = useContext(ScoresContext)
  if (!ctx) throw new Error('useScores must be used within ScoresProvider')
  return ctx
}

/**
 * The shared score list. `scores` is null while loading. Mounting a page
 * that calls this loads the list if it isn't in memory, and retries if the
 * previous attempt failed.
 */
export function useScores(): { scores: ScoreListItem[] | null; error: string | null } {
  const { scores, error, request } = useScoresContext()
  useEffect(() => {
    request()
  }, [request])
  return { scores, error }
}

/**
 * Returns a function that discards the shared list. Call it after creating,
 * updating or deleting a score; the next list page reloads it.
 */
export function useInvalidateScores(): () => void {
  return useScoresContext().invalidate
}
