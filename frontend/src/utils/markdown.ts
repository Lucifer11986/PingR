/**
 * Einfacher Markdown-Parser für PingR
 * Unterstützt: **fett**, *kursiv*, `code`, ```codeblock```, ~~strike~~, > blockquote
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function parseMarkdown(text: string): string {
  if (!text) return ''

  // Code-Blöcke (``` ... ```) zuerst extrahieren
  const codeBlocks: string[] = []
  let result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = escapeHtml(code.trim())
    const langLabel = lang ? `<span style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px;display:block">${escapeHtml(lang)}</span>` : ''
    codeBlocks.push(`<pre style="background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;overflow-x:auto;margin:4px 0;font-family:monospace;font-size:12px;line-height:1.5">${langLabel}<code>${escaped}</code></pre>`)
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })

  // HTML escapen (nach Code-Block-Extraktion)
  result = result
    .split('\x00CODE')
    .map((part, i) => {
      if (i === 0) return escapeHtml(part)
      const [idx, ...rest] = part.split('\x00')
      return `\x00CODE${idx}\x00` + escapeHtml(rest.join('\x00'))
    })
    .join('')

  // Inline-Code `code`
  result = result.replace(/`([^`]+)`/g,
    '<code style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:12px">$1</code>')

  // Blockquote > text
  result = result.replace(/^&gt;\s?(.+)$/gm,
    '<blockquote style="border-left:3px solid rgba(79,110,247,0.6);padding-left:10px;margin:4px 0;color:rgba(255,255,255,0.6);font-style:italic">$1</blockquote>')

  // Fett **text** oder __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Kursiv *text* oder _text_ (nicht innerhalb von Wörtern)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')

  // Durchgestrichen ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>')

  // URLs als Links (http/https)
  result = result.replace(
    /(?<!\[)(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">$1</a>'
  )

  // Zeilenumbrüche
  result = result.replace(/\n/g, '<br/>')

  // Code-Blöcke wieder einsetzen
  result = result.replace(/\x00CODE(\d+)\x00/g, (_m, i) => codeBlocks[parseInt(i)])

  return result
}

// URL-Erkennung für Link-Vorschau
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"]+/g) || []
  return [...new Set(matches)].slice(0, 3)  // max 3 URLs
}