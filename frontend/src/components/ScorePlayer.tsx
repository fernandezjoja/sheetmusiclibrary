import { useEffect, useMemo, useRef, useState } from 'react'
import {
  OpenSheetMusicDisplay,
  type Instrument,
  type Voice,
  type VoiceEntry,
} from 'opensheetmusicdisplay'
import PlaybackEngine from 'osmd-audio-player'
import { PlaybackEvent, PlaybackState } from 'osmd-audio-player/dist/PlaybackEngine'
import './ScorePlayer.css'

/**
 * One clickable note's rendered SVG element + its iteration step.
 * Built once after osmd.render(); used by handleScoreClick to do
 * pixel-exact hit testing via the browser's getBoundingClientRect.
 */
type ClickableNote = { el: SVGElement; step: number }

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type VoiceInfo = { label: string; muted: boolean; ref: Voice; color?: string }

// Global playback mode — applies one MIDI instrument to every voice in the
// score. General MIDI program numbers; the audio player uses soundfont-player
// to load each on demand.
type PlaybackMode = 'piano' | 'choir'
const PLAYBACK_MODES: { value: PlaybackMode; label: string; midiId: number }[] = [
  { value: 'piano', label: 'Piano', midiId: 0 },   // Acoustic Grand Piano
  { value: 'choir', label: 'Coro', midiId: 52 },  // Choir Aahs
]
const PLAYBACK_MODE_STORAGE_KEY = 'sml.playbackMode'

function readStoredPlaybackMode(): PlaybackMode {
  if (typeof localStorage === 'undefined') return 'piano'
  const stored = localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY)
  return PLAYBACK_MODES.some((m) => m.value === stored) ? (stored as PlaybackMode) : 'piano'
}

// PlaybackEngine internals exposed for click-to-play. These fields are declared
// `private` in the .d.ts but populated and stable enough to read/write — we
// need: `currentIterationStep` (for progress tracking), `scheduler` (to
// override the scheduler's "next-to-play" index after a seek), and `ac` (the
// AudioContext; we resume it on visibilitychange because iOS suspends audio
// when the page goes hidden and never auto-resumes).
type EngineInternals = {
  iterationSteps: number
  currentIterationStep: number
  scheduler: { setIterationStep(step: number): void }
  ac: { state: AudioContextState; resume(): Promise<void> }
}

/**
 * Walk the rendered score and return one entry per note that has a backing
 * SVG element. Each entry pairs the DOM element with its iteration step so a
 * click hit-test can directly map a clicked element back to the right step.
 *
 * Implementation notes:
 *   - Iteration step is computed by walking a fresh MusicPartManager iterator
 *     in parallel and recording (VoiceEntry → step) on first visit.
 *   - The rendered DOM element comes from VexFlow's StaveNote — OSMD attaches
 *     the rendered VexFlow object to each GraphicalVoiceEntry as `vfStaveNote`,
 *     and VexFlow stores the SVG group on `attrs.el` after rendering. These
 *     are runtime-only fields so we cast through a small interface.
 */
/**
 * For each measure in the score, the iterator step at which it begins.
 * `measureStarts[m]` is the step where measure `m` begins; the array is in
 * ascending step order so a binary search resolves any step → measure index.
 *
 * Built by walking the same iterator used in {@link buildClickableNotes} and
 * recording the step every time {@code CurrentMeasureIndex} changes. Empty
 * measures (no notes) still bump the index so they appear here.
 */
function buildMeasureStarts(osmd: OpenSheetMusicDisplay): number[] {
  const iter = osmd.Sheet.MusicPartManager.getIterator()
  const starts: number[] = []
  let step = 0
  let lastMeasure = -1
  while (!iter.EndReached) {
    const measureIdx = iter.CurrentMeasureIndex
    if (measureIdx !== lastMeasure) {
      starts.push(step)
      lastMeasure = measureIdx
    }
    iter.moveToNext()
    step++
  }
  return starts
}

function buildClickableNotes(osmd: OpenSheetMusicDisplay): ClickableNote[] {
  const veToStep = new Map<VoiceEntry, number>()
  const iter = osmd.Sheet.MusicPartManager.getIterator()
  let step = 0
  while (!iter.EndReached) {
    const entries = iter.CurrentVoiceEntries as VoiceEntry[] | undefined
    if (entries) {
      for (const ve of entries) {
        if (!veToStep.has(ve)) veToStep.set(ve, step)
      }
    }
    iter.moveToNext()
    step++
  }

  type VfBacked = { vfStaveNote?: { attrs?: { el?: SVGElement } } }
  const result: ClickableNote[] = []
  // GraphicSheet.MeasureList is a 2D array: outer = vertical staff index,
  // inner = measure number. Each entry is a GraphicalMeasure (or undefined
  // if a staff is hidden in that measure).
  for (const row of osmd.GraphicSheet.MeasureList ?? []) {
    for (const measure of row ?? []) {
      if (!measure) continue
      for (const se of measure.staffEntries ?? []) {
        for (const gve of se.graphicalVoiceEntries ?? []) {
          const s = veToStep.get(gve.parentVoiceEntry)
          if (s === undefined) continue
          const el = (gve as unknown as VfBacked).vfStaveNote?.attrs?.el
          if (el) result.push({ el, step: s })
        }
      }
    }
  }
  return result
}

/** A stavenote SVG element + which voice index it belongs to, plus the
 *  voice indices that share at least one pitch with this voice at the same
 *  step. When `sharedWith` is non-empty and any of those voices is also
 *  unmuted, we paint the element with a blend of the involved voice colors
 *  so a unison reads as "both voices are here". */
type NoteHighlight = {
  el: SVGElement
  voiceIndex: number
  sharedWith: number[]
}

/** Average a set of #rrggbb colors in sRGB. Cheap enough for the few times
 *  per playback iteration we'd ever call it. */
function blendHexColors(colors: string[]): string {
  if (colors.length === 0) return '#000000'
  if (colors.length === 1) return colors[0]
  let r = 0
  let g = 0
  let b = 0
  for (const hex of colors) {
    const c = hex.startsWith('#') ? hex.slice(1) : hex
    r += parseInt(c.slice(0, 2), 16)
    g += parseInt(c.slice(2, 4), 16)
    b += parseInt(c.slice(4, 6), 16)
  }
  const n = colors.length
  const toHex = (v: number) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Walk the score and return a map: iteration step → [highlights at that step].
 * Each highlight pairs a stavenote SVG element with the voice index it
 * belongs to (matched by reference equality against the supplied VoiceInfo
 * list).
 *
 * A note is registered at *every* step where it's still sounding (start step
 * through end-of-duration), not just at its onset. This way, when the soprano
 * advances to a new quarter, the alto's still-ringing half note keeps its
 * highlight.
 */
function buildNoteHighlights(
  osmd: OpenSheetMusicDisplay,
  voices: VoiceInfo[],
): Map<number, NoteHighlight[]> {
  // First pass: walk a fresh iterator to capture each step's source timestamp
  // (in fractions of a whole note) and the start step of every VoiceEntry.
  const veToStep = new Map<VoiceEntry, number>()
  const stepTimestamps: number[] = []
  const iter = osmd.Sheet.MusicPartManager.getIterator()
  let step = 0
  while (!iter.EndReached) {
    const ts = iter.CurrentSourceTimestamp
    stepTimestamps[step] = ts ? ts.RealValue : step
    const entries = iter.CurrentVoiceEntries as VoiceEntry[] | undefined
    if (entries) {
      for (const ve of entries) {
        if (!veToStep.has(ve)) veToStep.set(ve, step)
      }
    }
    iter.moveToNext()
    step++
  }
  const totalSteps = stepTimestamps.length

  // Second pass: collect per-voice "raw entries" with start step, end step,
  // SVG element, and the set of pitches sounding (halfTone-based, skipping
  // rests). A pitch set lets us detect unisons across voices later.
  type RawEntry = {
    el: SVGElement
    voiceIndex: number
    startStep: number
    endStep: number
    pitches: Set<number>
  }
  type VfBacked = { vfStaveNote?: { attrs?: { el?: SVGElement } } }
  const rawEntries: RawEntry[] = []
  const EPS = 1e-9

  for (const row of osmd.GraphicSheet.MeasureList ?? []) {
    for (const measure of row ?? []) {
      if (!measure) continue
      for (const se of measure.staffEntries ?? []) {
        for (const gve of se.graphicalVoiceEntries ?? []) {
          const sourceVE = gve.parentVoiceEntry
          const voiceIndex = voices.findIndex((v) => v.ref === sourceVE.ParentVoice)
          if (voiceIndex < 0) continue
          const startStep = veToStep.get(sourceVE)
          if (startStep === undefined) continue

          const notes = sourceVE.Notes ?? []
          if (notes.length === 0) continue

          const pitches = new Set<number>()
          let duration = 0
          for (const n of notes) {
            const maybe = n as {
              isRest?: () => boolean
              IsRest?: boolean
              halfTone?: number
              Length?: { RealValue?: number }
            }
            const isRest = (maybe.isRest?.() ?? maybe.IsRest) === true
            if (!isRest && typeof maybe.halfTone === 'number') {
              pitches.add(maybe.halfTone)
            }
            const len = maybe.Length?.RealValue ?? 0
            if (len > duration) duration = len
          }
          // Skip rest-only entries — the rest symbol shouldn't pulse.
          if (pitches.size === 0) continue
          if (duration <= 0) continue

          const el = (gve as unknown as VfBacked).vfStaveNote?.attrs?.el
          if (!el) continue

          const startTs = stepTimestamps[startStep] ?? 0
          const endTs = startTs + duration
          let endStep = startStep + 1
          while (
            endStep < totalSteps &&
            stepTimestamps[endStep] < endTs - EPS
          ) {
            endStep++
          }

          rawEntries.push({ el, voiceIndex, startStep, endStep, pitches })
        }
      }
    }
  }

  // Third pass: bucket entries by every step they're audible in, then for
  // each step compute pairwise pitch overlaps to populate `sharedWith`.
  const activeAtStep = new Map<number, RawEntry[]>()
  for (const entry of rawEntries) {
    for (let s = entry.startStep; s < entry.endStep; s++) {
      if (!activeAtStep.has(s)) activeAtStep.set(s, [])
      activeAtStep.get(s)!.push(entry)
    }
  }

  const result = new Map<number, NoteHighlight[]>()
  for (const [s, entries] of activeAtStep) {
    const highlights: NoteHighlight[] = []
    for (const entry of entries) {
      const sharedWith: number[] = []
      for (const other of entries) {
        if (other === entry) continue
        if (other.voiceIndex === entry.voiceIndex) continue
        // Any pitch in common counts as a unison for highlighting purposes.
        let overlaps = false
        for (const p of other.pitches) {
          if (entry.pitches.has(p)) {
            overlaps = true
            break
          }
        }
        if (overlaps && !sharedWith.includes(other.voiceIndex)) {
          sharedWith.push(other.voiceIndex)
        }
      }
      highlights.push({
        el: entry.el,
        voiceIndex: entry.voiceIndex,
        sharedWith,
      })
    }
    result.set(s, highlights)
  }
  return result
}

// Hardcoded SATB labels and color codes assumed for 4-voice scores. Both
// authoring shapes — closed-score (2 instruments × 2 voices) and open-score
// (4 instruments × 1 voice) — traverse to the same order. Colors fill the
// voice chip when the voice is unmuted; all four meet WCAG AA contrast with
// white text.
const SATB_VOICES = [
  { label: 'Soprano', color: '#0067c6' },
  { label: 'Alto', color: '#d5008c' },
  { label: 'Tenor', color: '#d62f00' },
  { label: 'Bajo', color: '#008000' },
] as const

/**
 * Build one mute-toggle entry per <voice> in the score.
 *
 * Most of our scores are 4-voice SATB; when that's the case, label the
 * voices Soprano / Alto / Tenor / Bajo regardless of what the MusicXML
 * happens to call its instruments. For other voice counts, fall back to
 * generic positional labels.
 */
function buildVoiceInfos(instruments: Instrument[]): VoiceInfo[] {
  const flat: { voice: Voice; instIdx: number; voiceIdx: number }[] = []
  instruments.forEach((inst, instIdx) => {
    inst.Voices.forEach((voice, voiceIdx) => {
      flat.push({ voice, instIdx, voiceIdx })
    })
  })

  if (flat.length === 4) {
    return flat.map(({ voice }, i) => ({
      label: SATB_VOICES[i].label,
      color: SATB_VOICES[i].color,
      muted: false,
      ref: voice,
    }))
  }

  // Fallback for non-4-voice scores: use the instrument name when it has a
  // single voice, otherwise generic positional labels.
  const isTwoStaffLayout = instruments.length === 2
  return flat.map(({ voice, instIdx, voiceIdx }) => {
    const inst = instruments[instIdx]
    const staffPrefix = isTwoStaffLayout
      ? instIdx === 0
        ? 'TS'
        : 'BS'
      : `S${instIdx + 1}`
    const label =
      inst.Voices.length === 1 && inst.Name?.trim()
        ? inst.Name.trim()
        : `${staffPrefix} V${voiceIdx + 1}`
    return { label, muted: false, ref: voice }
  })
}

export default function ScorePlayer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PlaybackEngine | null>(null)
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null)
  const clickableNotesRef = useRef<ClickableNote[]>([])
  const measureStartsRef = useRef<number[]>([])
  // Set to true after a seek to step > 0 so the next ITERATION event can
  // undo the audio player's automatic cursor advance (which would put cursor
  // on the note *after* the one we landed on).
  const undoFirstAdvanceRef = useRef(false)
  // Pre-computed (step → notes-to-highlight) map, plus the highlights that
  // are currently painted (so we can clear them on the next iteration / on
  // stop / when a voice is muted).
  const noteHighlightsByStepRef = useRef<Map<number, NoteHighlight[]>>(new Map())
  const activeHighlightsRef = useRef<NoteHighlight[]>([])
  // The voices state is captured in the ITERATION closure when it's
  // registered. To read live mute state at iteration time we mirror it here.
  const voicesRef = useRef<VoiceInfo[]>([])
  const [status, setStatus] = useState<Status>('loading-score')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(readStoredPlaybackMode)

  // Touch-primary devices (phones, tablets) get buggy click-to-jump because
  // taps land between notes more easily on small screens; users have the
  // progress bar for navigation. Detected once at mount — viewport rotation
  // doesn't change pointer type.
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )

  // Click-to-jump is enabled only after the user has started playback at
  // least once (any non-STOPPED state). Clicking Stop disables it again
  // until the next Play. Off entirely on touch.
  const clickToJumpEnabled =
    status === 'ready' && !isTouchDevice && playbackState !== PlaybackState.STOPPED

  // Progress-bar seek follows the same "must have started playback" rule
  // (so a fresh score doesn't tease a clickable timeline that does nothing
  // useful), but stays available on touch — phones rely on it.
  const progressBarEnabled = status === 'ready' && playbackState !== PlaybackState.STOPPED

  // Note-highlight helpers — defined before the load effect because the
  // ITERATION handler closes over them. They operate purely on refs, so
  // they don't need to be useCallback'd.
  const clearActiveHighlights = () => {
    for (const { el } of activeHighlightsRef.current) {
      el.classList.remove('score-note-highlighted')
      el.style.removeProperty('--voice-highlight-color')
    }
    activeHighlightsRef.current = []
  }

  const applyHighlightsForStep = (step: number) => {
    const targets = noteHighlightsByStepRef.current.get(step)
    if (!targets) return
    const liveVoices = voicesRef.current
    for (const target of targets) {
      const v = liveVoices[target.voiceIndex]
      if (!v || v.muted || !v.color) continue
      // If this voice shares a pitch with another voice that's also active
      // (and unmuted), blend their colors so a unison reads as "both voices
      // are here" instead of one stomping on the other.
      const colors = [v.color]
      for (const otherIdx of target.sharedWith) {
        const other = liveVoices[otherIdx]
        if (other && !other.muted && other.color) colors.push(other.color)
      }
      const color = colors.length === 1 ? colors[0] : blendHexColors(colors)
      target.el.style.setProperty('--voice-highlight-color', color)
      target.el.classList.add('score-note-highlighted')
      activeHighlightsRef.current.push(target)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let engine: PlaybackEngine | null = null

    setStatus('loading-score')
    setErrorMessage(null)
    setVoices([])
    setCurrentStep(0)
    setTotalSteps(0)

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      // ScoreDetail already shows the title (from the DB) above the player,
      // so suppress OSMD's typeset title to avoid the duplication.
      // Subtitle / composer / lyricist / credits are kept so MusicXML-only
      // metadata still surfaces in the typeset header.
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawLyricist: true,
      drawCredits: true,
      cursorsOptions: [
        // Translucent black — a soft shadow over the current note. Neutral
        // (doesn't compete with the colored voice indicators), reads as a
        // system control rather than score content.
        // `follow` auto-scrolls the page to keep the cursor in view during
        // playback. Disabled on touch-primary devices (phones, tablets)
        // where the auto-scroll fights the user's manual scroll gestures.
        // Seek-jumps still trigger an explicit scrollIntoView in handleSeek
        // for predictable centering on any device.
        {
          type: 0,
          color: '#000000',
          alpha: 0.18,
          follow:
            typeof window === 'undefined'
              ? true
              : !window.matchMedia?.('(pointer: coarse)').matches,
        },
      ],
      // Honor system / page breaks from the MusicXML itself
      // (`<print new-system>` / `<print new-page>` elements).
      // Requires the source MusicXML to actually include them — in MuseScore,
      // enable Preferences → Import & Export → MusicXML → "Export layout"
      // before exporting, and (if you want a specific look) drag system-break
      // marks at the measures where you want lines to wrap. The wide
      // .score-inner canvas (CSS) gives OSMD enough horizontal room that
      // authored breaks are typically the only ones that fire — width-driven
      // auto-wraps only kick in if you author a system that exceeds the
      // canvas width.
      newSystemFromXML: true,
      newPageFromXML: true,
      // Tempo info (♩=N markings) is needed in the MusicXML so the audio
      // engine respects the chant pulse, but we don't want to clutter the
      // visible score with it. Skip drawing entirely — the iterator still
      // reads the tempo data from the source measures for playback.
      drawMetronomeMarks: false,
    })
    // Add some breathing room around header text (default is 1 OSMD unit each,
    // which causes title / subtitle / composer to crowd together).
    osmd.EngravingRules.TitleTopDistance = 5
    osmd.EngravingRules.TitleBottomDistance = 4
    osmd.EngravingRules.SheetMinimumDistanceBetweenTitleAndSubtitle = 3
    osmd.EngravingRules.SystemComposerDistance = 4
    // Tighten note-to-note spacing within each measure (default 0.85). Chant
    // is sparse — long notes, lyrics-driven layout — so the default leaves
    // measures looking airy. 0.7 packs them more like the printed PDF.
    osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 0.7
    osmdRef.current = osmd

    ;(async () => {
      try {
        await osmd.load(url)
        if (cancelled) return
        osmd.render()
        if (cancelled) return

        setStatus('loading-audio')
        engine = new PlaybackEngine()
        engineRef.current = engine

        engine.on(PlaybackEvent.STATE_CHANGE, (state: PlaybackState) => {
          if (cancelled) return
          setPlaybackState(state)
          if (state === PlaybackState.STOPPED) {
            setCurrentStep(0)
            clearActiveHighlights()
          }
        })

        await engine.loadScore(osmd)
        if (cancelled) return

        const internals = engine as unknown as EngineInternals
        engine.on(PlaybackEvent.ITERATION, () => {
          if (cancelled) return
          // The audio player's iterationCallback auto-advances the cursor on
          // every iteration after step 0 (`if (currentIterationStep > 0)
          // cursor.next()`). After a seek, we want the *clicked* note to play
          // first, not the one after it — so we undo that single advance the
          // first time iter fires post-seek. The cursor lands back on the
          // note the user clicked, audio plays it, and from the next iter
          // onwards advances proceed normally.
          if (undoFirstAdvanceRef.current) {
            osmd.cursor.previous()
            undoFirstAdvanceRef.current = false
          }
          setCurrentStep(internals.currentIterationStep)
          // Note auto-advances `currentIterationStep` past the audible note
          // (it's been incremented inside iterationCallback before this fires),
          // so the audible step is currentIterationStep - 1.
          const audibleStep = Math.max(0, internals.currentIterationStep - 1)
          clearActiveHighlights()
          applyHighlightsForStep(audibleStep)
        })

        // Make the cursor visible immediately (the audio player only calls
        // cursor.show() inside play() on first run, so without this the
        // user sees nothing until they click Play — and seeking before
        // playing wouldn't visibly move the cursor either).
        osmd.cursors.forEach((cursor) => cursor.show())

        // Build a flat list of (rendered SVG element, iteration step) pairs
        // so click handling can do exact DOM hit-testing instead of brittle
        // coordinate math. Browser's getBoundingClientRect handles all SVG
        // transforms, scroll offsets, and zoom for us.
        clickableNotesRef.current = buildClickableNotes(osmd)
        measureStartsRef.current = buildMeasureStarts(osmd)

        const builtVoices = buildVoiceInfos(engine.scoreInstruments)
        // Pre-populate voicesRef so the highlight logic can read live mute
        // state on the first iteration (voices state hasn't flushed yet).
        voicesRef.current = builtVoices
        noteHighlightsByStepRef.current = buildNoteHighlights(osmd, builtVoices)

        setVoices(builtVoices)
        setPlaybackState(engine.state)
        setTotalSteps(internals.iterationSteps)
        setStatus('ready')
      } catch (e: unknown) {
        if (cancelled) return
        setErrorMessage(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      if (engine) {
        // Stop is async and we're tearing down — fire-and-forget is fine here.
        engine.stop().catch(() => {})
      }
      engineRef.current = null
      osmdRef.current = null
      clickableNotesRef.current = []
      measureStartsRef.current = []
      noteHighlightsByStepRef.current = new Map()
      activeHighlightsRef.current = []
      container.innerHTML = ''
    }
  }, [url])

  // iOS Safari suspends the AudioContext whenever the page goes hidden (URL
  // bar collapse during scroll, tab switch, app backgrounded). It never
  // auto-resumes. Without this hook the engine's play() does nothing audible
  // and the iteration callback that drives cursor / highlights stalls.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const engine = engineRef.current
      if (!engine) return
      const ac = (engine as unknown as EngineInternals).ac
      if (ac && ac.state === 'suspended') {
        ac.resume().catch(() => {
          // Resume can reject if the user hasn't gestured yet — that's fine,
          // the next play-button tap will trigger resume too.
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Mirror voices state into a ref so the ITERATION handler reads live mute
  // state. Also drop highlights on any voice that just became muted so the
  // mute is reflected immediately (otherwise it'd persist until the next note).
  useEffect(() => {
    voicesRef.current = voices
    for (let i = activeHighlightsRef.current.length - 1; i >= 0; i--) {
      const h = activeHighlightsRef.current[i]
      const v = voices[h.voiceIndex]
      if (!v || v.muted) {
        h.el.classList.remove('score-note-highlighted')
        h.el.style.removeProperty('--voice-highlight-color')
        activeHighlightsRef.current.splice(i, 1)
      }
    }
  }, [voices])

  // Responsive scale: OSMD lays out the score against .score-inner's fixed
  // CSS width (see ScorePlayer.css) — the same canvas regardless of viewport.
  // On narrower viewports we shrink the entire rendered SVG with a CSS
  // transform — no reflow, identical layout, just smaller pixels.
  // The browser's transform-aware getBoundingClientRect keeps click hit-tests
  // and cursor scrollIntoView correct under scaling.
  useEffect(() => {
    if (status !== 'ready') return
    const outer = outerRef.current
    const inner = containerRef.current
    if (!outer || !inner) return

    const update = () => {
      const outerW = outer.clientWidth
      // The score's natural width is per-score, so read it off the rendered
      // inner box (transform doesn't affect offsetWidth — layout box is
      // pre-transform).
      const innerW = inner.offsetWidth
      if (innerW === 0) return
      const scale = Math.min(1, outerW / innerW)
      if (scale === 1) {
        inner.style.transform = ''
        outer.style.height = ''
      } else {
        inner.style.transform = `scale(${scale})`
        // Layout box of inner is unchanged by the transform, so offsetHeight
        // gives the unscaled rendered height. The visual height is that × scale,
        // which is what outer should clip to.
        outer.style.height = `${inner.offsetHeight * scale}px`
      }
    }

    const ro = new ResizeObserver(update)
    ro.observe(outer)
    ro.observe(inner)

    return () => ro.disconnect()
  }, [status])

  // Apply the selected playback instrument to every voice, and persist the
  // choice. Runs whenever the score finishes loading (status -> ready) or the
  // user picks a different mode. setInstrument is async (loads the SoundFont
  // for the MIDI program on first use); subsequent switches to the same mode
  // are cached and instant.
  useEffect(() => {
    if (status !== 'ready') return
    const engine = engineRef.current
    if (!engine) return

    const midiId = PLAYBACK_MODES.find((m) => m.value === playbackMode)?.midiId ?? 0
    let cancelled = false
    ;(async () => {
      for (const inst of engine.scoreInstruments) {
        for (const voice of inst.Voices) {
          if (cancelled) return
          try {
            await engine.setInstrument(voice, midiId)
          } catch {
            // If a SoundFont fails to load (network glitch, missing program),
            // the audio player falls back to piano internally. Surface nothing
            // to the user — silent fallback is a better UX than an alarm.
          }
        }
      }
    })()

    try {
      localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, playbackMode)
    } catch {
      // localStorage may be disabled in some privacy modes; preference simply
      // won't persist across sessions, which is acceptable.
    }

    return () => {
      cancelled = true
    }
  }, [status, playbackMode])

  // Spacebar toggles play/pause once the player is ready. Mirrors the
  // standard media-player shortcut (YouTube, MuseScore, Spotify, etc.).
  useEffect(() => {
    if (status !== 'ready') return

    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      // Don't hijack space while the user is typing in a form field.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return

      const engine = engineRef.current
      if (!engine) return

      e.preventDefault() // suppress the default page-scroll on space
      if (playbackState === PlaybackState.PLAYING) {
        engine.pause()
      } else {
        engine.play().catch((err: unknown) =>
          setErrorMessage(err instanceof Error ? err.message : String(err)),
        )
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [status, playbackState])

  const handlePlay = () => {
    engineRef.current?.play().catch((e: unknown) =>
      setErrorMessage(e instanceof Error ? e.message : String(e)),
    )
  }
  const handlePause = () => {
    engineRef.current?.pause()
  }
  const handleStop = () => {
    engineRef.current?.stop().catch(() => {})
  }

  const seekToStep = (step: number, scrollMode: 'center' | 'nearest' | 'none') => {
    const engine = engineRef.current
    const osmd = osmdRef.current
    if (!engine || !osmd) return
    const target = Math.max(0, Math.min(Math.max(0, totalSteps - 1), step))
    const wasPlaying = playbackState === PlaybackState.PLAYING

    // Workaround: the audio player's jumpToStep takes a "reset + walk forward"
    // path on rewinds and a "walk forward only" path on forward seeks. The
    // forward-only path leaves the cursor / scheduler in an off-by-one state
    // that desyncs the cursor from playback by one note. Round-tripping through
    // step 0 first guarantees the reset branch runs, fixing the desync.
    if (target > 0) engine.jumpToStep(0)
    engine.jumpToStep(target)
    setCurrentStep(target)

    // jumpToStep deliberately sets the scheduler one step ahead of the cursor
    // (so a normal "resume from here" plays the next note). We want the
    // *clicked* note to play, so override the scheduler's next-to-play index
    // and arm undoFirstAdvance so the first iter callback's automatic cursor
    // advance gets reverted. For step 0 the audio player already starts at 0
    // without an advance, so no override is needed.
    if (target > 0) {
      const internals = engine as unknown as EngineInternals
      internals.scheduler.setIterationStep(target)
      undoFirstAdvanceRef.current = true
    } else {
      undoFirstAdvanceRef.current = false
    }

    if (scrollMode !== 'none') {
      const cursorEl = osmd.cursors[0]?.cursorElement
      if (cursorEl) {
        cursorEl.scrollIntoView({ behavior: 'smooth', block: scrollMode })
      }
    }

    // jumpToStep pauses internally; resume if the user was playing when they clicked.
    if (wasPlaying) engine.play().catch(() => {})
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSteps === 0) return
    if (!progressBarEnabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekToStep(Math.floor(fraction * totalSteps), 'center')
  }

  /**
   * Largest measure index whose start is at or before {@code step}, via binary
   * search on the (ascending) {@code measureStarts} array. Returns 0 if the
   * array is empty (no score loaded).
   */
  const measureIndexAt = (step: number): number => {
    const starts = measureStartsRef.current
    let lo = 0
    let hi = starts.length - 1
    let result = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (starts[mid] <= step) {
        result = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return result
  }

  /**
   * Conventional audio-player rewind: if mid-measure, snap to its start;
   * if already exactly at the start of a measure, jump to the previous one.
   * No-op at step 0 (no measure to fall back to).
   */
  const handleFastBackward = () => {
    const starts = measureStartsRef.current
    if (starts.length === 0 || currentStep === 0) return
    const idx = measureIndexAt(currentStep)
    const target = currentStep === starts[idx] && idx > 0 ? starts[idx - 1] : starts[idx]
    seekToStep(target, 'center')
  }

  const handleFastForward = () => {
    const starts = measureStartsRef.current
    if (starts.length === 0) return
    const next = starts[measureIndexAt(currentStep) + 1]
    if (next !== undefined) seekToStep(next, 'center')
  }

  const handleScoreClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalSteps === 0) return
    if (!clickToJumpEnabled) return
    // DOM-native hit test: walk the precomputed (notehead element, step)
    // pairs and find the first element whose bounding rect contains the
    // click pixel. Browser handles SVG transforms, scroll, and zoom; no
    // coordinate math needed. Click on whitespace = no rect contains it = no-op.
    for (const { el, step } of clickableNotesRef.current) {
      const rect = el.getBoundingClientRect()
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        seekToStep(step, 'none')
        return
      }
    }
  }

  const toggleMute = (idx: number) => {
    setVoices((prev) =>
      prev.map((info, i) => {
        if (i !== idx) return info
        const newMuted = !info.muted
        // osmd-audio-player reads voice.Volume during note scheduling
        // (getNoteVolume returns note.ParentVoiceEntry.ParentVoice.Volume).
        // Setting the Voice's Volume directly mutes that voice only — even
        // when multiple voices share a Part / staff (closed-score layout).
        info.ref.Volume = newMuted ? 0 : 1
        return { ...info, muted: newMuted }
      }),
    )
  }

  return (
    <div>
      {status === 'loading-score' && <p>Cargando partitura…</p>}
      {status === 'loading-audio' && <p>Cargando audio…</p>}
      {status === 'error' && (
        <p role="alert">Failed to render score: {errorMessage}</p>
      )}

      {status === 'ready' && (
        <div className="score-dock">
          {/* Progress bar — click to seek to that step. */}
          <div
            className="score-dock-progress"
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, totalSteps - 1)}
            aria-valuenow={currentStep}
            onClick={handleSeek}
            style={{ cursor: progressBarEnabled ? 'pointer' : 'default' }}
          >
            <div className="score-dock-progress-track">
              <div
                className="score-dock-progress-fill"
                style={{
                  width:
                    totalSteps > 0
                      ? `${(currentStep / Math.max(1, totalSteps - 1)) * 100}%`
                      : '0%',
                }}
              />
            </div>
          </div>

          <div className="score-dock-row">
            <div className="score-dock-transport">
              <button
                type="button"
                className="score-dock-btn"
                onClick={handleFastBackward}
                disabled={
                  totalSteps === 0 ||
                  currentStep === 0 ||
                  playbackState === PlaybackState.STOPPED
                }
                aria-label="Previous measure"
                title="Previous measure"
              >
                ⏮
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={playbackState === PlaybackState.PLAYING ? handlePause : handlePlay}
                aria-label={playbackState === PlaybackState.PLAYING ? 'Pause' : 'Play'}
                title={
                  playbackState === PlaybackState.PLAYING ? 'Pause (space)' : 'Play (space)'
                }
              >
                {playbackState === PlaybackState.PLAYING ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={handleStop}
                disabled={playbackState === PlaybackState.STOPPED}
                aria-label="Stop"
                title="Stop"
              >
                ⏹
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={handleFastForward}
                disabled={
                  totalSteps === 0 ||
                  playbackState === PlaybackState.STOPPED ||
                  measureIndexAt(currentStep) >= measureStartsRef.current.length - 1
                }
                aria-label="Next measure"
                title="Next measure"
              >
                ⏭
              </button>
            </div>

            <span className="score-dock-sound-label">Instrumento:</span>
            <div
              className="score-dock-segmented"
              role="group"
              aria-label="Playback sound"
            >
              {PLAYBACK_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className="score-dock-segmented-btn"
                  onClick={() => setPlaybackMode(m.value)}
                  aria-pressed={m.value === playbackMode}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {voices.length > 0 && (
            <div
              className="score-dock-voices"
              role="group"
              aria-label="Voices"
            >
              {voices.map((info, i) => (
                <button
                  key={i}
                  type="button"
                  className="score-dock-voice"
                  onClick={() => toggleMute(i)}
                  aria-pressed={!info.muted}
                  aria-label={`${info.label} ${info.muted ? '(muted)' : ''}`}
                  style={
                    info.color
                      ? ({ '--voice-color': info.color } as React.CSSProperties)
                      : undefined
                  }
                >
                  {info.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="score-outer" ref={outerRef}>
        <div
          ref={containerRef}
          onClick={handleScoreClick}
          className="score-inner"
          style={{ cursor: clickToJumpEnabled ? 'pointer' : 'default' }}
        />
      </div>
    </div>
  )
}
