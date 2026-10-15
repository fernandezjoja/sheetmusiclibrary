import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import { formatTag } from '../tags'
import ScoreListSkeleton from '../components/ScoreListSkeleton'
import ScoreRow from '../components/ScoreRow'
import { useScores } from '../scores'
import { usePageTitle } from '../usePageTitle'
import { compareTitlesEs } from '../sort'

/** Lowercases and strips accents, so "proquimeno" matches "Proquímeno". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Everything a score can be found by: title, composer, and each tag both raw
 * (`tone:5`) and as displayed (`Tono 5`).
 */
function searchText(score: ScoreListItem): string {
  return normalize(
    [score.title, score.composer ?? '', ...score.tags, ...score.tags.map(formatTag)].join(' '),
  )
}

export default function ScoresList() {
  usePageTitle('Todas las partituras')
  const { scores, error } = useScores()
  const [query, setQuery] = useState('')

  // Alphabetical by title. compareTitlesEs handles Spanish-locale collation
  // plus numeric awareness for embedded Roman/Arabic numerals (so "Tono III"
  // sorts before "Tono IV" and "Salmo 9" before "Salmo 10").
  const indexed = useMemo(
    () =>
      [...(scores ?? [])]
        .sort((a, b) => compareTitlesEs(a.title, b.title))
        .map((score) => ({ score, text: searchText(score) })),
    [scores],
  )

  if (error) return <p role="alert">Error al cargar las partituras: {error}</p>
  if (!scores) {
    return (
      <article>
        <h2>Todas las partituras</h2>
        <ScoreListSkeleton />
      </article>
    )
  }
  if (scores.length === 0) {
    return (
      <article>
        <h2>Todas las partituras</h2>
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          No hay partituras todavía.
        </p>
        <p style={{ marginTop: 24 }}>
          <Link to="/biblioteca">← Volver a la biblioteca</Link>
        </p>
      </article>
    )
  }

  // Every word typed must appear somewhere in the score's text, in any order.
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const results = indexed
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .map(({ score }) => score)

  return (
    <article>
      <h2>Todas las partituras</h2>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título, compositor o etiqueta…"
        aria-label="Buscar partituras"
        className="search-input"
      />
      <p
        role="status"
        style={{ color: 'var(--text)', fontSize: '0.85rem', margin: '6px 0 0' }}
      >
        {words.length === 0
          ? `${scores.length} partituras`
          : `${results.length} de ${scores.length} partituras`}
      </p>
      {results.length === 0 && (
        <p style={{ color: 'var(--text)', fontStyle: 'italic' }}>
          Ninguna partitura coincide con «{query.trim()}».
        </p>
      )}
      <ul className="score-list" style={{ marginTop: 12 }}>
        {results.map((s) => (
          <ScoreRow key={s.id} score={s} />
        ))}
      </ul>

      <p style={{ marginTop: 24 }}>
        <Link to="/biblioteca">← Volver a la biblioteca</Link>
      </p>
    </article>
  )
}
