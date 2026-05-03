type Props = {
  url: string
  title?: string
}

/**
 * Extract a YouTube video id + optional start-time from any of the common
 * URL shapes (youtu.be, watch?v=, embed/), parsing the `t` / `start` time
 * param including h/m/s formats. Returns null if the URL is anything we
 * don't recognize as YouTube — caller should fall back to a plain link.
 */
function youtubeEmbedUrl(rawUrl: string): string | null {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }

  let videoId: string | null = null
  if (u.hostname === 'youtu.be') {
    videoId = u.pathname.slice(1).split('/')[0] || null
  } else if (
    u.hostname === 'youtube.com' ||
    u.hostname.endsWith('.youtube.com')
  ) {
    if (u.pathname === '/watch') {
      videoId = u.searchParams.get('v')
    } else if (u.pathname.startsWith('/embed/')) {
      videoId = u.pathname.split('/')[2] || null
    }
  }
  if (!videoId) return null

  // Optional start time. Accept "30", "30s", "1m30s", "1h2m3s".
  let start = 0
  const t = u.searchParams.get('t') ?? u.searchParams.get('start')
  if (t) {
    if (/^\d+$/.test(t)) {
      start = parseInt(t, 10)
    } else {
      for (const match of t.matchAll(/(\d+)([hms])/g)) {
        const n = parseInt(match[1], 10)
        if (match[2] === 'h') start += n * 3600
        else if (match[2] === 'm') start += n * 60
        else start += n
      }
    }
  }

  const embed = `https://www.youtube-nocookie.com/embed/${videoId}`
  return start > 0 ? `${embed}?start=${start}` : embed
}

/**
 * Responsive 16:9 YouTube iframe (privacy-enhanced no-cookie domain). Falls
 * back to a plain external link when the URL doesn't parse as YouTube — so
 * a misclassified reference still works.
 */
export default function YouTubeEmbed({ url, title }: Props) {
  const embedUrl = youtubeEmbedUrl(url)
  if (!embedUrl) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    )
  }
  return (
    <div
      style={{
        position: 'relative',
        paddingBottom: '56.25%',
        height: 0,
        overflow: 'hidden',
        maxWidth: 560,
      }}
    >
      <iframe
        src={embedUrl}
        title={title ?? 'YouTube video'}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
      />
    </div>
  )
}
