import type { Score } from './api'

/**
 * Tag formatting helpers for the structured tag conventions documented
 * alongside the music library:
 *
 *   service:liturgy       → "Liturgy"
 *   slot:cherubic-hymn    → "Cherubic Hymn"
 *   context:pascha        → "Pascha"
 *   context:default       → hidden (default is the un-marked case)
 *   tone:5                → "Tone 5"
 *   chant:lesser-znamenny → "Lesser Znamenny"
 *   voicing:satb          → "SATB"  (acronym kept uppercase)
 *
 * Tags without a `prefix:` portion are treated as free-form / legacy.
 */

const ACRONYMS = new Set(['satb', 'sab', 'ttbb', 'ssaa'])

export function formatTag(tag: string): string {
  const colonIdx = tag.indexOf(':')
  const value = colonIdx === -1 ? tag : tag.slice(colonIdx + 1)
  if (tag.startsWith('tone:')) return `Tone ${value}`
  if (ACRONYMS.has(value.toLowerCase())) return value.toUpperCase()
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function findTag(tags: string[], prefix: string): string | undefined {
  return tags.find((t) => t.startsWith(prefix))
}

/**
 * Right-side attribution: "Composer · Chant Style" / "Composer" / "Chant Style"
 * Returns [] if neither is available — callers can decide whether to show nothing.
 */
export function attributionParts(score: Score): string[] {
  const parts: string[] = []
  const composer = score.composer?.trim()
  const chant = findTag(score.tags, 'chant:')
  if (composer) parts.push(composer)
  if (chant) parts.push(formatTag(chant))
  return parts
}

/**
 * Liturgical role chain for the row's secondary line:
 *   Service · Slot · Context (when ≠ default) · Tone
 */
export function liturgicalRoleParts(score: Score): string[] {
  const parts: string[] = []
  const service = findTag(score.tags, 'service:')
  const slot = findTag(score.tags, 'slot:')
  const context = findTag(score.tags, 'context:')
  const tone = findTag(score.tags, 'tone:')
  if (service) parts.push(formatTag(service))
  if (slot) parts.push(formatTag(slot))
  if (context && context !== 'context:default') parts.push(formatTag(context))
  if (tone) parts.push(formatTag(tone))
  return parts
}

/** Tags without a `prefix:` portion (legacy / un-namespaced). */
export function freeFormTags(score: Score): string[] {
  return score.tags.filter((t) => !t.includes(':'))
}
