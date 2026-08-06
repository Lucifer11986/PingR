import { useState, useEffect, useRef } from 'react'

interface GifResult { id: string; url: string; preview: string; title: string }
interface Props { onPick: (url: string) => void; onClose: () => void }

const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY || ''

export default function GifPicker({ onPick, onClose }: Props) {
  const [query,   setQuery]   = useState('')
  const [gifs,    setGifs]    = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const search = async (q: string) => {
    if (!TENOR_KEY) { setError('no_key'); return }
    setLoading(true); setError('')
    try {
      const url = q
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=16&media_filter=gif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=16&media_filter=gif`
      const res  = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const results: GifResult[] = (data.results || []).map((r: any) => {
        const gif     = r.media_formats?.gif?.url     || r.media_formats?.mediumgif?.url || ''
        const preview = r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url   || gif
        return { id: r.id, url: gif, preview, title: r.title || '' }
      }).filter((r: GifResult) => r.url)
      setGifs(results)
      if (results.length === 0) setError('Keine GIFs gefunden')
    } catch (e: any) {
      setError('GIFs konnten nicht geladen werden')
      console.error('[GifPicker]', e)
    } finally { setLoading(false) }
  }

  useEffect(() => { search('') }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), 500)
  }

  const renderContent = () => {
    if (error === 'no_key') {
      return (
        <div style={{ padding:'20px', textAlign:'center' }}>
          <p style={{ fontSize:'13px', color:'#e8b86d', marginBottom:'8px' }}>⚙️ API-Key fehlt</p>
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', lineHeight:1.5 }}>
            Hol dir einen kostenlosen Key unter{' '}
            <a href="https://developers.google.com/tenor" target="_blank" rel="noreferrer"
              style={{ color:'#e8b86d' }}>developers.google.com/tenor</a>
            {' '}und trage ihn als <code style={{ background:'rgba(255,255,255,0.06)', padding:'1px 5px', borderRadius:4 }}>VITE_TENOR_API_KEY</code> in die .env ein.
          </p>
        </div>
      )
    }
    if (loading) {
      return <div style={{ textAlign:'center', padding:'60px 0', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>Lade GIFs…</div>
    }
    if (error) {
      return <div style={{ textAlign:'center', padding:'40px 0', color:'rgba(255,255,255,0.3)', fontSize:'12px' }}>{error}</div>
    }
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
        {gifs.map(gif => (
          <button key={gif.id} onClick={() => onPick(gif.url)}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.06)', padding:0, cursor:'pointer', borderRadius:'10px', overflow:'hidden', aspectRatio:'16/9', display:'block' }}>
            <img src={gif.preview} alt={gif.title}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
              loading="lazy"
              onError={e => { (e.target as HTMLImageElement).src = gif.url }} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div style={{ position:'absolute', bottom:'52px', left:0, width:'320px', background:'#0d0f18', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'16px', overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,0.7)', zIndex:100 }}>
      <div style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:'8px', alignItems:'center' }}>
        <span style={{ fontSize:'16px' }}>😂</span>
        <input value={query} onChange={e => handleSearch(e.target.value)}
          placeholder="GIF suchen…" autoFocus
          style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'8px', padding:'6px 10px', color:'white', fontSize:'12px', outline:'none' }} />
        <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>✕</button>
      </div>
      <div style={{ height:'260px', overflowY:'auto', padding:'8px' }}>
        {renderContent()}
      </div>
      <div style={{ padding:'4px 12px 6px', textAlign:'right' }}>
        <span style={{ fontSize:'9px', color:'rgba(255,255,255,0.15)' }}>Powered by Tenor</span>
      </div>
    </div>
  )
}