import { useEffect, useRef, useState } from 'react'
import { AlphaTabApi, NotationElement, PlayerMode, model, synth } from '@coderline/alphatab'
import { fitTimeSignaturesToContent, hideRewrittenTimeSignatures } from './alphaTabFreeTime'
import { hideInvisibleNotes, patchHiddenNotes } from './alphaTabHiddenNotes'
import { layOutRecitationLyrics } from './alphaTabLyrics'
import { applyMusicXmlLayout, findMusicXmlLayout, type MusicXmlLayout } from './alphaTabModelLayout'
import { findSlashedNotes, markSlashedNotes, patchSlashedNotes, type SlashedNote } from './alphaTabSlashedNotes'
import { placeSlursByVoice } from './alphaTabSlurDirection'
import { listVoiceChannels, routeVoicesToChannels, type VoiceChannel } from './alphaTabVoiceChannels'
import './ScorePlayer.css'

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type VoiceInfo = { label: string; muted: boolean; channel: number; color?: string }

// 4-voice scores get SATB labels and chip colors. Closed score (2 tracks ×
// 2 voices) and open score (4 tracks × 1 voice) both list in S, A, T, B order.
const SATB_VOICES = [
  { label: 'Soprano', color: '#0067c6' },
  { label: 'Alto', color: '#d5008c' },
  { label: 'Tenor', color: '#d62f00' },
  { label: 'Bajo', color: '#008000' },
] as const

// Global playback sound: one General MIDI program applied to every track.
// Both are in the bundled sonivox soundfont.
type PlaybackMode = 'piano' | 'choir'
const PLAYBACK_MODES: { value: PlaybackMode; label: string; program: number }[] = [
  { value: 'piano', label: 'Instrumental', program: 71 }, // Clarinet
  { value: 'choir', label: 'Coro', program: 52 }, // Choir Aahs
]
const PLAYBACK_MODE_STORAGE_KEY = 'sml.playbackMode'

function readStoredPlaybackMode(): PlaybackMode {
  try {
    const stored = localStorage.getItem(PLAYBACK_MODE_STORAGE_KEY)
    return PLAYBACK_MODES.some((m) => m.value === stored) ? (stored as PlaybackMode) : 'piano'
  } catch {
    return 'piano'
  }
}

function applyProgram(score: model.Score, mode: PlaybackMode): void {
  const program = PLAYBACK_MODES.find((m) => m.value === mode)?.program ?? 0
  for (const track of score.tracks) {
    track.playbackInfo.program = program
    // The MusicXML importer also turns each part's <midi-program> into an
    // instrument automation on its first beat. Its program change is emitted
    // after the track's initial one at the same tick, so it would win.
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            for (const automation of beat.automations) {
              if (automation.type === model.AutomationType.Instrument) automation.value = program
            }
          }
        }
      }
    }
  }
}

// Width alphaTab lays the score out at: the score panel's content box on
// desktop (960px page column minus the panel's 16px padding each side).
// Narrower screens keep this layout (same bars per system) and draw it
// smaller through display.scale, since alphaTab lays out at
// container width / scale. Never scales up.
const LAYOUT_WIDTH = 928
// alphaTab's default page padding. It's in screen pixels and gets divided by
// the scale during layout, so it has to shrink with the scale or the margins
// grow on small screens and fewer bars fit per system.
const PAGE_PADDING = 35

// On phones the score is laid out narrower than desktop and drawn larger.
// Lines still match desktop when the score carries MuseScore's layout
// (alphaTabModelLayout.ts); only the bars get tighter. 840 keeps lyric
// syllables from running into each other on the densest scores (760 made
// some merge at a 390px screen).
const PHONE_MAX_WIDTH = 600
const PHONE_LAYOUT_WIDTH = 840

function applyScale(display: { scale: number; padding: number[] }, width: number): void {
  const layoutWidth = width < PHONE_MAX_WIDTH ? PHONE_LAYOUT_WIDTH : LAYOUT_WIDTH
  const scale = width > 0 ? Math.min(1, width / layoutWidth) : 1
  display.scale = scale
  display.padding = [PAGE_PADDING * scale, PAGE_PADDING * scale]
}

// Playback transposition range, in semitones each way.
const MAX_TRANSPOSE = 5

// Rapid rewind / forward taps chain off the previous tap's target instead of
// the live position (which keeps advancing during playback), so repeated
// rewinds walk back measure by measure instead of snapping to the same start.
const SEEK_CHAIN_WINDOW_MS = 1000
// The player reports a position slightly past the tick it was sent to (e.g.
// 11521 after seeking to 11520), so "at a measure start" allows this much.
const MEASURE_START_TOLERANCE_TICKS = 30

/** Index of the last measure starting at or before tick (0 if none). */
function measureIndexAt(starts: number[], tick: number): number {
  let lo = 0
  let hi = starts.length - 1
  let result = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= tick) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

// Holding a voice chip this long solos it instead of toggling its mute.
const LONG_PRESS_MS = 500

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function buildVoiceInfos(channels: VoiceChannel[]): VoiceInfo[] {
  if (channels.length === 4) {
    return channels.map((c, i) => ({ ...SATB_VOICES[i], muted: false, channel: c.channel }))
  }
  return channels.map((c) => {
    const name = c.track.name?.trim() || `Pista ${c.track.index + 1}`
    const shared = channels.filter((o) => o.track === c.track).length > 1
    return {
      label: shared ? `${name} voz ${c.voiceIndex + 1}` : name,
      muted: false,
      channel: c.channel,
    }
  })
}

export default function ScorePlayer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [status, setStatus] = useState<Status>('loading-score')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [stopped, setStopped] = useState(true)
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [position, setPosition] = useState({ current: 0, end: 0, tick: 0 })
  // alphaTab rewinds to 0 the moment a piece finishes, so the bar would drop
  // from ~99% to empty without ever showing the end. Show it full until the
  // next play or seek.
  const [finished, setFinished] = useState(false)
  const finishedAtRef = useRef(0)
  // Measure start ticks in playback order (repeats included), refreshed on
  // every MIDI (re)generation.
  const [measureStarts, setMeasureStarts] = useState<number[]>([])
  // Most recent user-initiated measure jump, for SEEK_CHAIN_WINDOW_MS.
  const lastUserSeekRef = useRef<{ tick: number; at: number } | null>(null)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(readStoredPlaybackMode)
  // Read by scoreLoaded (registered once per URL) to pick the initial program.
  const playbackModeRef = useRef(playbackMode)
  const [transpose, setTranspose] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Long-press tracking for voice chips (see LONG_PRESS_MS).
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setStatus('loading-score')
    setErrorMessage(null)
    setVoices([])
    setTranspose(0)
    setPlaying(false)
    setStopped(true)
    setPosition({ current: 0, end: 0, tick: 0 })
    setFinished(false)
    setMeasureStarts([])

    // alphaTab defaults, except:
    //   - all tracks rendered (load(…, [-1]) below): by default only the
    //     first track is, which would hide the bottom staff of a closed score.
    //   - core.fontDirectory: alphaTab derives it from its own script URL,
    //     which in dev is Vite's pre-bundle folder (node_modules/.vite/deps/)
    //     where the font doesn't exist. Point it at the copy that
    //     @coderline/alphatab-vite puts in public/font/.
    //   - player enabled with the soundfont the same plugin copies into
    //     public/soundfont/. The player is off by default.
    //   - secondaryGlyphColor black: alphaTab draws voices 2+ of a staff at
    //     40% opacity, which fades alto and bass in a closed score.
    //   - score header (title, subtitle, composer, lyricist, copyright)
    //     hidden: ScoreDetail already shows title and composer above.
    //   - bar numbers hidden.
    //   - staff text (MusicXML <words>, e.g. "Obikhod Tono 8 Estiquio"):
    //     14px bold italic instead of 12px italic.
    //   - lyrics upright, 15px (about the old OSMD player's size on desktop).
    //   - core.useWorkers false: render on the main thread so the
    //     renderer patches (alphaTabFreeTime.ts, alphaTabSlurDirection.ts,
    //     alphaTabLyrics.ts, alphaTabHiddenNotes.ts, alphaTabSlashedNotes.ts)
    //     apply.
    hideRewrittenTimeSignatures()
    placeSlursByVoice()
    layOutRecitationLyrics()
    patchHiddenNotes()
    patchSlashedNotes()
    routeVoicesToChannels()
    const display = { scale: 1, padding: [PAGE_PADDING, PAGE_PADDING] }
    applyScale(display, container.offsetWidth)
    const api = new AlphaTabApi(container, {
      core: { fontDirectory: '/font/', useWorkers: false },
      display: {
        ...display,
        resources: {
          secondaryGlyphColor: '#000',
          elementFonts: new Map([
            // CSS string form: alphaTab's Font.fromJson expects a Map for the
            // object form (despite its types) and throws on a plain object.
            [NotationElement.EffectText, 'italic bold 14px Georgia, serif'],
            [NotationElement.EffectLyrics, '15px Georgia, serif'],
          ]),
        },
      },
      notation: {
        elements: new Map([
          [NotationElement.ScoreTitle, false],
          [NotationElement.ScoreSubTitle, false],
          [NotationElement.ScoreArtist, false],
          [NotationElement.ScoreAlbum, false],
          [NotationElement.ScoreWords, false],
          [NotationElement.ScoreMusic, false],
          [NotationElement.ScoreWordsAndMusic, false],
          [NotationElement.ScoreCopyright, false],
          [NotationElement.BarNumber, false],
        ]),
      },
      player: {
        playerMode: PlayerMode.EnabledSynthesizer,
        soundFont: '/soundfont/sonivox.sf2',
      },
    })
    apiRef.current = api

    // alphaTab fires resize (with its settings) before every re-layout on a
    // width change, e.g. phone rotation. The initial one fires inside the
    // constructor, which is why the first scale is set in the settings above.
    api.resize.on((e) => {
      if (e.settings) applyScale(e.settings.display, e.newWidth)
    })

    // The MusicXML is fetched here rather than through core.file so what
    // alphaTab's importer drops (slashed noteheads, MuseScore's system
    // layout) can be read from the same bytes.
    let slashedNotes: SlashedNote[] = []
    let musicXmlLayout: MusicXmlLayout | null = null
    let cancelled = false

    api.scoreLoaded.on((score) => {
      fitTimeSignaturesToContent(score)
      hideInvisibleNotes(score)
      markSlashedNotes(score, slashedNotes)
      applyMusicXmlLayout(api, score, musicXmlLayout)
      // scoreLoaded fires before MIDI generation, so the first MIDI already
      // uses the selected sound.
      applyProgram(score, playbackModeRef.current)
      // Track names ("SA" / "TB" from the MusicXML part names) are rotated
      // vertically by default. scoreLoaded fires before rendering starts, so
      // the stylesheet change applies to the first render.
      score.stylesheet.firstSystemTrackNameOrientation = model.TrackNameOrientation.Horizontal
      score.stylesheet.otherSystemsTrackNameOrientation = model.TrackNameOrientation.Horizontal
      setVoices(buildVoiceInfos(listVoiceChannels(score)))
      setStatus('loading-audio')
    })
    // midiLoad fires after alphaTab rebuilds its tick cache from the MIDI.
    api.midiLoad.on(() => {
      setMeasureStarts(api.tickCache?.masterBars.map((m) => m.start) ?? [])
    })
    api.playerReady.on(() => setStatus('ready'))
    api.playerStateChanged.on((e) => {
      const isPlaying = e.state === synth.PlayerState.Playing
      setPlaying(isPlaying)
      setStopped(e.stopped)
      if (isPlaying) setFinished(false)
    })
    api.playerFinished.on(() => {
      finishedAtRef.current = Date.now()
      setFinished(true)
    })
    api.playerPositionChanged.on((e) => {
      setPosition({ current: e.currentTime, end: e.endTime, tick: e.currentTick })
      // alphaTab's own rewind right after finishing is reported as a seek to
      // 0; only other seeks (note click, progress bar, measure jump) count.
      const autoRewind = e.currentTime === 0 && Date.now() - finishedAtRef.current < 100
      if (e.isSeek && !autoRewind) setFinished(false)
    })
    api.error.on((e) => {
      setErrorMessage(e.message)
      setStatus('error')
    })

    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (cancelled) return
        slashedNotes = findSlashedNotes(bytes)
        musicXmlLayout = findMusicXmlLayout(bytes)
        api.load(bytes, [-1])
      } catch (e: unknown) {
        if (cancelled) return
        setErrorMessage(e instanceof Error ? e.message : String(e))
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      api.destroy()
      apiRef.current = null
    }
  }, [url])

  // Switching sound regenerates the MIDI with the new program. alphaTab's
  // MIDI reload stops playback and rewinds to 0, so position and play state
  // are restored afterwards. Channel mutes live in the synth and survive it.
  const changePlaybackMode = (mode: PlaybackMode) => {
    setPlaybackMode(mode)
    playbackModeRef.current = mode
    try {
      localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, mode)
    } catch {
      // Storage may be disabled (private mode); the choice just won't persist.
    }
    const api = apiRef.current
    if (!api?.score) return
    const time = api.timePosition
    const wasPlaying = playing
    applyProgram(api.score, mode)
    api.loadMidiForScore()
    // Reapply the live transposition in case the MIDI reload reset it.
    api.changeTrackTranspositionPitch(api.score.tracks, transpose)
    api.timePosition = time
    if (wasPlaying) api.play()
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const api = apiRef.current
    if (!api || position.end === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    api.timePosition = fraction * position.end
  }

  const seekChainBase = (liveTick: number): number => {
    const recent = lastUserSeekRef.current
    return recent && Date.now() - recent.at < SEEK_CHAIN_WINDOW_MS ? recent.tick : liveTick
  }

  const seekToTick = (tick: number) => {
    const api = apiRef.current
    if (!api) return
    api.tickPosition = tick
    lastUserSeekRef.current = { tick, at: Date.now() }
  }

  // Conventional rewind: mid-measure snaps to its start; at a measure start,
  // goes to the previous measure.
  const handlePreviousMeasure = () => {
    const api = apiRef.current
    if (!api || measureStarts.length === 0) return
    const base = seekChainBase(api.tickPosition)
    const idx = measureIndexAt(measureStarts, base)
    const atStart = base - measureStarts[idx] <= MEASURE_START_TOLERANCE_TICKS
    seekToTick(atStart && idx > 0 ? measureStarts[idx - 1] : measureStarts[idx])
  }

  const handleNextMeasure = () => {
    const api = apiRef.current
    if (!api || measureStarts.length === 0) return
    const next = measureStarts[measureIndexAt(measureStarts, seekChainBase(api.tickPosition)) + 1]
    if (next !== undefined) seekToTick(next)
  }

  const atFirstMeasureStart = position.tick <= (measureStarts[0] ?? 0) + MEASURE_START_TOLERANCE_TICKS
  const inLastMeasure = measureIndexAt(measureStarts, position.tick) >= measureStarts.length - 1

  // Live transposition in the synth, applied to both MIDI channels of every
  // track, so all voices move together. The score display doesn't change.
  const changeTranspose = (delta: number) => {
    const api = apiRef.current
    if (!api?.score) return
    const next = Math.max(-MAX_TRANSPOSE, Math.min(MAX_TRANSPOSE, transpose + delta))
    if (next === transpose) return
    api.changeTrackTranspositionPitch(api.score.tracks, next)
    setTranspose(next)
  }

  // Each voice plays on its own MIDI channel (see alphaTabVoiceChannels.ts),
  // so muting is per channel on the synth rather than alphaTab's per-track
  // changeTrackMute.
  const applyMutes = (mutedFor: (info: VoiceInfo, i: number) => boolean) => {
    const player = apiRef.current?.player
    if (!player) return
    setVoices((prev) =>
      prev.map((info, i) => {
        const muted = mutedFor(info, i)
        player.setChannelMute(info.channel, muted)
        return { ...info, muted }
      }),
    )
  }

  const toggleMute = (idx: number) => applyMutes((info, i) => (i === idx ? !info.muted : info.muted))

  // Solo: hear only this voice. Soloing the voice that's already the only one
  // audible unmutes everything again.
  const toggleSolo = (idx: number) => {
    const alreadySolo = voices.every((v, i) => v.muted === (i !== idx))
    applyMutes((_, i) => (alreadySolo ? false : i !== idx))
  }

  const startLongPress = (idx: number) => {
    longPressFiredRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true
      toggleSolo(idx)
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  const handleVoiceClick = (idx: number) => {
    // The click that ends a long press shouldn't also toggle the mute.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    toggleMute(idx)
  }

  // Keyboard shortcuts: space play/pause, ←/→ previous/next measure. Ignored
  // while typing in a form field or with modifier keys held.
  useEffect(() => {
    if (status !== 'ready') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      if (e.code === 'Space') {
        e.preventDefault()
        apiRef.current?.playPause()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlePreviousMeasure()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleNextMeasure()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const shownTime = finished ? position.end : position.current
  const progress = position.end > 0 ? (shownTime / position.end) * 100 : 0

  // Until the synth and soundfont are ready the dock renders its full layout
  // with every control disabled, so it doesn't change height when they load.
  const ready = status === 'ready'

  const playButton = (
    <button
      type="button"
      className="score-dock-btn score-dock-btn-primary"
      onClick={() => apiRef.current?.playPause()}
      disabled={!ready}
      aria-label={playing ? 'Pausa' : 'Reproducir'}
      title={playing ? 'Pausa (espacio)' : 'Reproducir (espacio)'}
    >
      {playing ? '⏸' : '▶'}
    </button>
  )

  return (
    <div>
      {status === 'loading-score' && <p>Cargando partitura…</p>}
      {status === 'error' && (
        <p role="alert">No se pudo cargar la partitura: {errorMessage}</p>
      )}

      {/* The dock shows from the start at its full size; controls stay
          disabled until the audio is ready (playerReady). */}
      {status !== 'error' && (
        <div className="score-dock">
          {/* Progress bar with time; click to seek. */}
          <div className="score-dock-row score-dock-progress-row">
            <div
              className="score-dock-progress"
              role="slider"
              aria-label="Posición de reproducción"
              aria-valuemin={0}
              aria-valuemax={Math.round(position.end)}
              aria-valuenow={Math.round(shownTime)}
              aria-valuetext={`${formatTime(shownTime)} de ${formatTime(position.end)}`}
              onClick={handleSeek}
            >
              <div className="score-dock-progress-track">
                <div className="score-dock-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {ready ? (
              <span className="score-dock-time">
                {formatTime(shownTime)} / {formatTime(position.end)}
              </span>
            ) : (
              <span className="score-dock-time score-dock-time-loading" role="status">
                <span className="score-dock-spinner" aria-hidden="true" />
                Cargando audio…
              </span>
            )}
          </div>

          <div className="score-dock-row">
            <div className="score-dock-transport">
              <button
                type="button"
                className="score-dock-btn"
                onClick={handlePreviousMeasure}
                disabled={!ready || atFirstMeasureStart}
                aria-label="Compás anterior"
                title="Compás anterior (←)"
              >
                ⏮
              </button>
              {playButton}
              <button
                type="button"
                className="score-dock-btn"
                onClick={() => apiRef.current?.stop()}
                disabled={!ready || stopped}
                aria-label="Detener"
                title="Detener (vuelve al inicio)"
              >
                ⏹
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={handleNextMeasure}
                disabled={!ready || inLastMeasure}
                aria-label="Compás siguiente"
                title="Compás siguiente (→)"
              >
                ⏭
              </button>
            </div>
          </div>

          {!ready && (
            <div className="score-dock-voices" aria-hidden="true">
              {SATB_VOICES.map((v) => (
                <button key={v.label} type="button" className="score-dock-voice" disabled>
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {ready && voices.length > 0 && (
            <div className="score-dock-voices" role="group" aria-label="Voces">
              {voices.map((info, i) => (
                <button
                  key={i}
                  type="button"
                  className="score-dock-voice"
                  onClick={() => handleVoiceClick(i)}
                  onPointerDown={() => startLongPress(i)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={!info.muted}
                  aria-label={`${info.label}${info.muted ? ' (silenciada)' : ''}`}
                  title="Toca para silenciar; mantén pulsado para escuchar solo esta voz"
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

          {/* Icon plus text label, in its own row right above the panel it
              opens: clearer than a bare gear icon for less technical users. */}
          <div className="score-dock-row">
            <button
              type="button"
              className="score-dock-settings-toggle"
              onClick={() => setSettingsOpen((o) => !o)}
              disabled={!ready}
              aria-expanded={settingsOpen}
              aria-controls="score-dock-settings"
            >
              <span aria-hidden="true">⚙</span> Ajustes{' '}
              <span className="score-dock-settings-arrow" aria-hidden="true" />
            </button>
          </div>

          {ready && settingsOpen && (
            <div id="score-dock-settings" className="score-dock-row score-dock-settings">
              <span className="score-dock-label">Semitono:</span>
              <div className="score-dock-segmented" role="group" aria-label="Transposición">
                <button
                  type="button"
                  className="score-dock-segmented-btn"
                  onClick={() => changeTranspose(-1)}
                  disabled={transpose <= -MAX_TRANSPOSE}
                  aria-label="Bajar un semitono"
                  title="Bajar un semitono"
                >
                  −
                </button>
                <span className="score-dock-transpose-value" aria-live="polite">
                  {transpose > 0 ? `+${transpose}` : transpose}
                </span>
                <button
                  type="button"
                  className="score-dock-segmented-btn"
                  onClick={() => changeTranspose(1)}
                  disabled={transpose >= MAX_TRANSPOSE}
                  aria-label="Subir un semitono"
                  title="Subir un semitono"
                >
                  +
                </button>
              </div>

              <div className="score-dock-segmented" role="group" aria-label="Sonido">
                {PLAYBACK_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className="score-dock-segmented-btn"
                    onClick={() => changePlaybackMode(m.value)}
                    aria-pressed={m.value === playbackMode}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="score-inner">
        <div ref={containerRef} />
      </div>
    </div>
  )
}
