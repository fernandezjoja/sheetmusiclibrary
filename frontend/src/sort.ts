/**
 * Title comparator for Spanish-locale alphabetical sort with numeric
 * awareness. Normalizes Roman numerals (I..XX) and Arabic numerals to a
 * fixed-width form so they compare in numeric order instead of lexically:
 *
 *   "Tono III" < "Tono IV" < "Tono X"   (Roman, numerical)
 *   "Salmo 9"  < "Salmo 10"             (Arabic, numerical)
 *
 * Uses Intl locale comparison ('es') so accents and ñ sort the way a Spanish
 * reader expects ("Ánfora" near "Anáfora", "ñ" after "n", etc.).
 *
 * Limits intentionally chosen for the chant-library domain:
 *   - Roman numerals capped at XX (covers tones 1-8, antiphons 1-3, ode
 *     numbers, "Tropario I/II/III", etc.). Add to ROMAN_VALUES if a real
 *     title ever needs higher.
 *   - Arabic numerals padded to 3 digits — sorts up to 999 correctly, plenty
 *     for psalms (1-150), measure numbers, hymn numbers, etc.
 *   - Roman matching is case-sensitive. Liturgical convention uses uppercase,
 *     and case-sensitive avoids false positives on words like "Vidi".
 */

const ROMAN_VALUES: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9,
  X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17,
  XVIII: 18, XIX: 19, XX: 20,
}

/** Transforms a title into a normalized form suitable for lex comparison. */
function titleSortKey(title: string): string {
  return title
    .replace(/\b[IVX]+\b/g, (m) => {
      const n = ROMAN_VALUES[m]
      return n !== undefined ? n.toString().padStart(3, '0') : m
    })
    .replace(/\b\d+\b/g, (m) => m.padStart(3, '0'))
}

/**
 * Compare two titles for Spanish-locale alphabetical sort, treating any
 * embedded Roman or Arabic numerals as numbers rather than character strings.
 * Suitable as a sort callback: `array.sort((a, b) => compareTitlesEs(a.title, b.title))`.
 */
export function compareTitlesEs(a: string, b: string): number {
  return titleSortKey(a).localeCompare(titleSortKey(b), 'es')
}
