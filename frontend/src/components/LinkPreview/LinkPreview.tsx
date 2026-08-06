import { useEffect, useState } from 'react'
import api from '../../services/api'

interface Preview {
  url: string; title?: string; description?: string
  image?: string; siteName?: string; favicon?: string
}

export default function LinkPreview({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    let ok = true
    api.get(`/api/linkpreview?url=${encodeURIComponent(url)}`)
      .then(({ data }) => { if (ok && data.title) setPreview(data) })
      .catch(() => {})
    return () => { ok = false }
  }, [url])

  if (!preview?.title) return null

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block', marginTop:'6px' }}>
      <div style={{
        background: isOwn ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius:'10px', overflow:'hidden', maxWidth:'300px',
      }}>
        {preview.image && (
          <img src={preview.image} alt="" style={{ width:'100%', height:'130px', objectFit:'cover', display:'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
        )}
        <div style={{ padding:'8px 10px' }}>
          {preview.siteName && (
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', marginBottom:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
              {preview.favicon && <img src={preview.favicon} width={12} height={12} alt="" onError={e => (e.target as HTMLImageElement).style.display='none'} />}
              {preview.siteName}
            </div>
          )}
          <div style={{ fontSize:'12px', fontWeight:600, color:'white', marginBottom:'2px', lineHeight:1.3 }}>{preview.title}</div>
          {preview.description && (
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)', lineHeight:1.4,
              overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
              {preview.description}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}