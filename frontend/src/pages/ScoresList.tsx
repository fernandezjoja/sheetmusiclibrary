import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ScoreListItem } from '../api'
import {
  attributionParts,
  formatTag,
  freeFormTags,
  liturgicalRoleParts,
} from '../tags'
import { useScores } from '../scores'
import { usePageTitle } from '../usePageTitle'
import { compareTitlesEs } from '../sort'

const searchStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  font: 'inherit',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text-h)',
} as const

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
  if (!scores) return <p>Cargando…</p>
  if (scores.length === 0) return <p>No hay partituras todavía.</p>

  // Every word typed must appear somewhere in the score's text, in any order.
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const results = indexed
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .map(({ score }) => score)

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título, compositor o etiqueta…"
        aria-label="Buscar partituras"
        style={searchStyle}
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
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((s) => {
          const attribution = attributionParts(s)
          const liturgical = liturgicalRoleParts(s)
          const freeForm = freeFormTags(s)
          const hasSecondaryLine = liturgical.length > 0 || freeForm.length > 0

          return (
            <li
              key={s.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <Link to={`/scores/${s.id}`} style={{ fontWeight: 500 }}>
                  {s.title}
                  {!s.published && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: '0.7em',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: '#f5e6c8',
                        color: '#8a5a00',
                        verticalAlign: 'middle',
                      }}
                      title="Versión de prueba — visible solo para usuarios autenticados"
                    >
                      PRUEBA
                    </span>
                  )}
                </Link>
                {attribution.length > 0 && (
                  <span
                    style={{
                      color: 'var(--text)',
                      fontSize: '0.95rem',
                      textAlign: 'right',
                    }}
                  >
                    {attribution.join(' · ')}
                  </span>
                )}
              </div>
              {hasSecondaryLine && (
                <div
                  style={{
                    marginTop: 4,
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                  }}
                >
                  {liturgical.length > 0 && liturgical.join(' · ')}
                  {liturgical.length > 0 && freeForm.length > 0 && ' · '}
                  {freeForm.length > 0 &&
                    freeForm.map((t) => `#${t}`).join(' ')}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
