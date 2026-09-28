import { Environment, type model } from '@coderline/alphatab'

/**
 * Extra space above systems that start a new page in the MuseScore layout.
 *
 * alphaTab's MusicXML importer turns both <print new-system="yes"> and
 * <print new-page="yes"> into plain line breaks, so page breaks are lost
 * after import. findPageBreaks reads them from the MusicXML itself, and
 * separatePageBreaks makes alphaTab add PAGE_BREAK_GAP to the top padding of
 * the systems that start at those measures.
 *
 * Private alphaTab API (checked against 1.8.4): Environment.defaultRenderers,
 * BarRendererBase.staff.system, and StaffSystem.finalizeSystem / topPadding.
 * Like the other renderer patches it only reaches main-thread rendering
 * (core.useWorkers: false).
 */

const PAGE_BREAK_GAP = 40

/** Indexes of the measures that start a new page (0-based, first part). */
export function findPageBreaks(musicXml: Uint8Array): Set<number> {
  const breaks = new Set<number>()
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(musicXml), 'application/xml')
  const part = doc.querySelector('part')
  if (!part) return breaks
  Array.from(part.children)
    .filter((el) => el.tagName === 'measure')
    .forEach((measure, index) => {
      if (index > 0 && measure.querySelector('print[new-page="yes"]')) breaks.add(index)
    })
  return breaks
}

const pageBreaksByScore = new WeakMap<model.Score, Set<number>>()

/** Associates the page breaks found in a score's MusicXML with the loaded score. */
export function setPageBreaks(score: model.Score, breaks: Set<number>): void {
  pageBreaksByScore.set(score, breaks)
}

type StaffSystemLike = {
  index: number
  topPadding: number
  firstBarIndex: number
  layout: { renderer: { score: model.Score | null } }
  finalizeSystem(): void
}
type ScoreBarRendererLike = { staff: { system: StaffSystemLike }; doLayout(): void }
type BarRendererFactoryLike = {
  staffId: string
  create(renderer: unknown, bar: model.Bar): ScoreBarRendererLike
}

let systemPatched = false

function patchStaffSystem(system: StaffSystemLike): void {
  if (systemPatched) return
  const proto = Object.getPrototypeOf(system) as StaffSystemLike
  const finalize = proto.finalizeSystem
  proto.finalizeSystem = function (this: StaffSystemLike) {
    finalize.call(this)
    const score = this.layout.renderer.score
    const breaks = score ? pageBreaksByScore.get(score) : undefined
    if (this.index > 0 && breaks?.has(this.firstBarIndex)) this.topPadding += PAGE_BREAK_GAP
  }
  systemPatched = true
}

let patched = false

/** Idempotent; call once before creating the AlphaTabApi. */
export function separatePageBreaks(): void {
  if (patched) return
  const factories = (Environment as unknown as { defaultRenderers: BarRendererFactoryLike[] })
    .defaultRenderers
  const factory = factories.find((f) => f.staffId === 'score')
  if (!factory) return
  // StaffSystem isn't exported; reach its prototype through the first bar
  // renderer laid out (alphaTab sets renderer.staff before doLayout).
  const create = factory.create.bind(factory)
  factory.create = (renderer, bar) => {
    const r = create(renderer, bar)
    const doLayout = r.doLayout.bind(r)
    r.doLayout = () => {
      patchStaffSystem(r.staff.system)
      doLayout()
    }
    return r
  }
  patched = true
}
