import { TAG_DISPLAY, isTagHidden } from './tagDisplay'

/**
 * Minimum shape needed by the tag helpers below. Both {@link Score} (the full
 * detail payload) and {@link ScoreListItem} (the slim listing payload) satisfy
 * it structurally, so the same helpers work for list pages and detail pages.
 */
type Taggable = { tags: string[]; composer?: string | null }

/**
 * Tag formatting helpers for the structured tag conventions documented
 * alongside the music library. Display labels come from TAG_DISPLAY in
 * tagDisplay.ts; unmapped values fall back to a generic title-cased render
 * of the raw value so nothing is "broken" if a new tag isn't translated yet.
 *
 *   service:liturgy       → "Liturgia"        (mapped)
 *   slot:cherubic-hymn    → "Himno Querúbico" (mapped)
 *   tone:5                → "Tono 5"          (special: numeric suffix)
 *   chant:obscure-tradition → "Obscure Tradition" (fallback: title-cased)
 *
 * Tags without a `prefix:` portion are treated as free-form / legacy and
 * passed through unchanged (rendered as `#hashtag` chips by the caller).
 */

const ACRONYMS = new Set(['satb', 'sab', 'ttbb', 'ssaa'])

export function formatTag(tag: string): string {
  const mapped = TAG_DISPLAY[tag]
  if (mapped !== undefined) return mapped
  const colonIdx = tag.indexOf(':')
  const value = colonIdx === -1 ? tag : tag.slice(colonIdx + 1)
  if (tag.startsWith('tone:')) return `Tono ${value}`
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
export function attributionParts(score: Taggable): string[] {
  const parts: string[] = []
  const composer = score.composer?.trim()
  const chant = findTag(score.tags, 'chant:')
  if (composer) parts.push(composer)
  if (chant && !isTagHidden(chant)) parts.push(formatTag(chant))
  return parts
}

/**
 * Liturgical role chain for the row's secondary line:
 *   Service · Slot · Context (when ≠ default) · Tone
 */
export function liturgicalRoleParts(score: Taggable): string[] {
  const parts: string[] = []
  const service = findTag(score.tags, 'service:')
  const slot = findTag(score.tags, 'slot:')
  const context = findTag(score.tags, 'context:')
  const tone = findTag(score.tags, 'tone:')
  if (service && !isTagHidden(service)) parts.push(formatTag(service))
  if (slot && !isTagHidden(slot)) parts.push(formatTag(slot))
  if (context && !isTagHidden(context)) parts.push(formatTag(context))
  if (tone && !isTagHidden(tone)) parts.push(formatTag(tone))
  return parts
}

/** Tags without a `prefix:` portion (legacy / un-namespaced). */
export function freeFormTags(score: Taggable): string[] {
  return score.tags.filter((t) => !t.includes(':') && !isTagHidden(t))
}
