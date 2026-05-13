import { useEffect } from 'react'

const SITE_NAME = 'Biblioteca de Música Litúrgica'

/**
 * Sets `document.title` for the current page. Pass nothing (or `undefined`)
 * on a landing page to show just the site name; otherwise the page label is
 * prepended: `"Octoechos · Biblioteca de Música Litúrgica"`.
 *
 * Passing a value derived from async state (e.g. a loaded score title) is
 * fine — the title updates whenever the value changes.
 */
export function usePageTitle(pageTitle?: string | null) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${SITE_NAME}` : SITE_NAME
  }, [pageTitle])
}
