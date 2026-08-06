import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import https from 'https'
import http from 'http'
import dns from 'dns/promises'
import net from 'net'

const router = Router()
router.use(authMiddleware)

interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 2, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
  }
  const normalized = address.toLowerCase()
  return normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) || normalized.startsWith('2001:db8:') ||
    normalized.startsWith('::ffff:')
}

async function resolvePublicUrl(rawUrl: string): Promise<{ url: URL; address: string; family: number }> {
  if (rawUrl.length > 2048) throw new Error('URL zu lang')
  const url = new URL(rawUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL nicht erlaubt')
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Port nicht erlaubt')
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(result => isPrivateAddress(result.address))) throw new Error('Interne Adresse nicht erlaubt')
  return { url, address: addresses[0].address, family: addresses[0].family }
}

async function fetchUrl(rawUrl: string, redirects = 0): Promise<{ html: string; finalUrl: string }> {
  if (redirects > 3) throw new Error('Zu viele Weiterleitungen')
  const { url, address, family } = await resolvePublicUrl(rawUrl)
  const client = url.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.get({
      protocol: url.protocol,
      hostname: address,
      family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      servername: url.hostname,
      headers: {
        Host: url.host,
        'User-Agent': 'Mozilla/5.0 (compatible; NokkiPreview/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 5000,
    }, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        const target = new URL(response.headers.location, url).toString()
        fetchUrl(target, redirects + 1).then(resolve).catch(reject)
        return
      }
      const contentType = String(response.headers['content-type'] || '')
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        response.resume(); reject(new Error('Kein HTML')); return
      }
      let data = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        data += chunk
        if (Buffer.byteLength(data, 'utf8') > 100_000) response.destroy(new Error('Antwort zu groß'))
      })
      response.on('end', () => resolve({ html: data, finalUrl: url.toString() }))
      response.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('Timeout')))
  })
}

function extractMeta(html: string, url: string): LinkPreview {
  const get = (pattern: RegExp) => {
    const match = html.match(pattern)
    return match ? match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().slice(0, 500) : undefined
  }
  const title = get(/property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    get(/name=["']twitter:title["']\s+content=["']([^"']+)["']/i) || get(/<title[^>]*>([^<]+)<\/title>/i)
  const description = get(/property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
    get(/name=["']description["']\s+content=["']([^"']+)["']/i)
  const image = get(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    get(/name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
  const siteName = get(/property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
  return { url, title, description, image, siteName, favicon: `${new URL(url).origin}/favicon.ico` }
}

const cache = new Map<string, { data: LinkPreview; ts: number }>()

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const rawUrl = String(req.query.url || '')
  try {
    const normalized = new URL(rawUrl).toString()
    const cached = cache.get(normalized)
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) { res.json(cached.data); return }
    const { html, finalUrl } = await fetchUrl(normalized)
    const preview = extractMeta(html, finalUrl)
    cache.set(normalized, { data: preview, ts: Date.now() })
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
    res.json(preview)
  } catch (_err) {
    res.status(400).json({ error: 'Linkvorschau für diese URL nicht verfügbar' })
  }
})

export default router
