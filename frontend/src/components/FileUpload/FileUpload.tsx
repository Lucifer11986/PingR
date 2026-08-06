import { useCallback, useRef, useState } from 'react'
import api from '../../services/api'
import { useChatStore } from '../../store/chatStore'

interface Props { conversationId: string; onClose: () => void }

export default function FileUpload({ conversationId, onClose }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const addMessage                = useChatStore(s => s.addMessage)
  const inputRef                  = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { alert('Max. 50 MB'); return }
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('conversationId', conversationId)
    try {
      const { data } = await api.post('/api/messages/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
      })
      addMessage(data)
      onClose()
    } catch (_err) {
      alert('Upload fehlgeschlagen.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [conversationId, addMessage, onClose])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (uploading) return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'rgba(255,255,255,0.05)', borderRadius:'10px', minWidth:'140px' }}>
      <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)' }}>📎 {progress}%</span>
      <div style={{ flex:1, background:'rgba(255,255,255,0.1)', borderRadius:'99px', height:'4px' }}>
        <div style={{ background:'#3b82f6', height:'4px', borderRadius:'99px', width:`${progress}%`, transition:'width 0.2s' }} />
      </div>
    </div>
  )

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      style={{
        border: '1.5px dashed rgba(255,255,255,0.25)',
        borderRadius: '10px',
        padding: '5px 12px',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.5)',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
    >
      <span>📎</span>
      <span>Datei (max. 50 MB)</span>
      <input ref={inputRef} type="file" style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}