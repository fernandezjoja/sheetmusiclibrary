import { useEffect, useRef, useState } from 'react'
import { AlphaTabApi, NotationElement, PlayerMode, model, synth } from '@coderline/alphatab'
import { fitTimeSignaturesToContent, hideRewrittenTimeSignatures } from './alphaTabFreeTime'
import './ScorePlayer.css'

type Props = { url: string }
type Status = 'loading-score' | 'loading-audio' | 'ready' | 'error'
type TrackInfo = { label: string; muted: boolean; ref: model.Track }

export default function ScorePlayer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [status, setStatus] = useState<Status>('loading-score')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [stopped, setStopped] = useState(true)
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [position, setPosition] = useState({ current: 0, end: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setStatus('loading-score')
    setErrorMessage(null)
    setTracks([])
    setPlaying(false)
    setStopped(true)
    setPosition({ current: 0, end: 0 })

    // alphaTab defaults, except:
    //   - core.tracks 'all': by default only the first track is rendered,
    //     which would hide the bottom staff of a closed score.
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
    //   - core.useWorkers false: render on the main thread so the
    //     time-signature patch in alphaTabFreeTime.ts applies.
    hideRewrittenTimeSignatures()
    const api = new AlphaTabApi(container, {
      core: { file: url, tracks: 'all', fontDirectory: '/font/', useWorkers: false },
      display: { resources: { secondaryGlyphColor: '#000' } },
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
        ]),
      },
      player: {
        playerMode: PlayerMode.EnabledSynthesizer,
        soundFont: '/soundfont/sonivox.sf2',
      },
    })
    apiRef.current = api

    api.scoreLoaded.on((score) => {
      fitTimeSignaturesToContent(score)
      // Track names ("SA" / "TB" from the MusicXML part names) are rotated
      // vertically by default. scoreLoaded fires before rendering starts, so
      // the stylesheet change applies to the first render.
      score.stylesheet.firstSystemTrackNameOrientation = model.TrackNameOrientation.Horizontal
      score.stylesheet.otherSystemsTrackNameOrientation = model.TrackNameOrientation.Horizontal
      setTracks(
        score.tracks.map((t) => ({
          label: t.name?.trim() || `Pista ${t.index + 1}`,
          muted: false,
          ref: t,
        })),
      )
      setStatus('loading-audio')
    })
    api.playerReady.on(() => setStatus('ready'))
    api.playerStateChanged.on((e) => {
      setPlaying(e.state === synth.PlayerState.Playing)
      setStopped(e.stopped)
    })
    api.playerPositionChanged.on((e) => {
      setPosition({ current: e.currentTime, end: e.endTime })
    })
    api.error.on((e) => {
      setErrorMessage(e.message)
      setStatus('error')
    })

    return () => {
      api.destroy()
      apiRef.current = null
    }
  }, [url])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const api = apiRef.current
    if (!api || position.end === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    api.timePosition = fraction * position.end
  }

  const toggleMute = (idx: number) => {
    const api = apiRef.current
    if (!api) return
    setTracks((prev) =>
      prev.map((info, i) => {
        if (i !== idx) return info
        const muted = !info.muted
        api.changeTrackMute([info.ref], muted)
        return { ...info, muted }
      }),
    )
  }

  const progress = position.end > 0 ? (position.current / position.end) * 100 : 0

  return (
    <div>
      {status === 'loading-score' && <p>Cargando partitura…</p>}
      {status === 'loading-audio' && <p>Cargando audio…</p>}
      {status === 'error' && (
        <p role="alert">Failed to render score: {errorMessage}</p>
      )}

      {status === 'ready' && (
        <div className="score-dock">
          {/* Progress bar — click to seek to that time. */}
          <div
            className="score-dock-progress"
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(position.end)}
            aria-valuenow={Math.round(position.current)}
            onClick={handleSeek}
            style={{ cursor: 'pointer' }}
          >
            <div className="score-dock-progress-track">
              <div className="score-dock-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="score-dock-row">
            <div className="score-dock-transport">
              <button
                type="button"
                className="score-dock-btn"
                onClick={() => apiRef.current?.playPause()}
                aria-label={playing ? 'Pause' : 'Play'}
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <button
                type="button"
                className="score-dock-btn"
                onClick={() => apiRef.current?.stop()}
                disabled={stopped}
                aria-label="Stop"
                title="Stop"
              >
                ⏹
              </button>
            </div>
          </div>

          {tracks.length > 0 && (
            <div className="score-dock-voices" role="group" aria-label="Tracks">
              {tracks.map((info, i) => (
                <button
                  key={i}
                  type="button"
                  className="score-dock-voice"
                  onClick={() => toggleMute(i)}
                  aria-pressed={!info.muted}
                  aria-label={`${info.label} ${info.muted ? '(muted)' : ''}`}
                >
                  {info.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="score-inner" ref={containerRef} />
    </div>
  )
}
