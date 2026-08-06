import dns from 'dns/promises'
import net from 'net'

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const ip = address.toLowerCase().split('%')[0]
  return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')
    || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')
    || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:192.168.')
}

export async function validatePublicWebhookUrl(input: string): Promise<URL> {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Ungültige Webhook-URL') }
  if (url.protocol !== 'https:') throw new Error('Webhook-URL muss HTTPS verwenden')
  if (url.username || url.password) throw new Error('Zugangsdaten in der URL sind nicht erlaubt')
  if (url.port && !['443', '8443'].includes(url.port)) throw new Error('Nur die HTTPS-Ports 443 und 8443 sind erlaubt')
  const hostname = url.hostname.replace(/\.$/, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) throw new Error('Lokale Adressen sind nicht erlaubt')
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('Private oder reservierte Zieladressen sind nicht erlaubt')
  return url
}
