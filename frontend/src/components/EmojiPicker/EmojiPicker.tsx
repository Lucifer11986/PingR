import EmojiPickerReact, { EmojiClickData, Theme } from 'emoji-picker-react'

interface Props {
  onSelect?: (emoji: string) => void
  onPick?:   (emoji: string) => void
  onEmoji?:  (emoji: string) => void
}

export default function EmojiPicker({ onSelect, onPick, onEmoji }: Props) {
  // Akzeptiert alle möglichen Prop-Namen
  const handler = onSelect ?? onPick ?? onEmoji ?? (() => {})
  return (
    <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', boxShadow:'0 16px 48px rgba(0,0,0,0.6)' }}>
      <EmojiPickerReact
        theme={Theme.DARK}
        onEmojiClick={(data: EmojiClickData) => handler(data.emoji)}
        width={320}
        height={380}
        searchPlaceholder="Emoji suchen…"
        lazyLoadEmojis
      />
    </div>
  )
}