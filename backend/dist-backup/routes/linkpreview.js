"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https_1.default : http_1.default;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PingRBot/1.0)',
                'Accept': 'text/html',
            },
            timeout: 5000,
        }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrl(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                data += chunk;
                if (data.length > 50000) {
                    req.destroy();
                    resolve(data);
                }
            });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}
function extractMeta(html, url) {
    const get = (pattern) => {
        const m = html.match(pattern);
        return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : undefined;
    };
    const title = get(/property="og:title"\s+content="([^"]+)"/i)
        || get(/name="twitter:title"\s+content="([^"]+)"/i)
        || get(/<title[^>]*>([^<]+)<\/title>/i);
    const description = get(/property="og:description"\s+content="([^"]+)"/i)
        || get(/name="description"\s+content="([^"]+)"/i);
    const image = get(/property="og:image"\s+content="([^"]+)"/i)
        || get(/name="twitter:image"\s+content="([^"]+)"/i);
    const siteName = get(/property="og:site_name"\s+content="([^"]+)"/i);
    const origin = new URL(url).origin;
    const favicon = `${origin}/favicon.ico`;
    return { url, title, description, image, siteName, favicon };
}
// Cache für Preview-Daten (in-memory, 10 Minuten)
const cache = new Map();
// GET /api/linkpreview?url=...
router.get('/', async (req, res) => {
    try {
        const url = String(req.query.url || '');
        if (!url || !url.startsWith('http')) {
            res.status(400).json({ error: 'Ungültige URL' });
            return;
        }
        // Blocklist: keine internen IPs
        const hostname = new URL(url).hostname;
        if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) {
            res.status(400).json({ error: 'Interne URLs nicht erlaubt' });
            return;
        }
        // Cache prüfen
        const cached = cache.get(url);
        if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
            res.json(cached.data);
            return;
        }
        const html = await fetchUrl(url);
        const preview = extractMeta(html, url);
        cache.set(url, { data: preview, ts: Date.now() });
        // Cache-Größe begrenzen
        if (cache.size > 500) {
            const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
            cache.delete(oldest[0]);
        }
        res.json(preview);
    }
    catch (_err) {
        res.status(200).json({ url: String(req.query.url), title: undefined });
    }
});
exports.default = router;
