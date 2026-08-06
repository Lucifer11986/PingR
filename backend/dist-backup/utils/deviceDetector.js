"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDevice = detectDevice;
exports.formatDeviceForLog = formatDeviceForLog;
function detectDevice(userAgent) {
    const ua = userAgent || '';
    // ── Gerättyp ──────────────────────────────────────────────────────────────
    // Reihenfolge wichtig: Tablet vor Mobile prüfen
    let deviceType = 'desktop';
    if (/tablet|ipad/i.test(ua)) {
        deviceType = 'tablet';
    }
    else if (/mobile|android|iphone|ipod|blackberry|opera mini|windows phone|webos/i.test(ua) ||
        // Android ohne "mobile" Keyword (Chrome auf Android)
        (/android/i.test(ua) && !/mobile/i.test(ua) === false) ||
        // Kleine Bildschirme via User-Agent Hints
        /\(Linux;.*Android/i.test(ua)) {
        deviceType = 'mobile';
    }
    // ── Betriebssystem ────────────────────────────────────────────────────────
    let os = 'Unbekannt';
    if (/windows nt 10/i.test(ua))
        os = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua))
        os = 'Windows 8.1';
    else if (/windows nt 6\.1/i.test(ua))
        os = 'Windows 7';
    else if (/windows/i.test(ua))
        os = 'Windows';
    else if (/android/i.test(ua)) {
        const m = ua.match(/android\s([\d.]+)/i);
        os = m ? `Android ${m[1]}` : 'Android';
    }
    else if (/iphone/i.test(ua)) {
        const m = ua.match(/os\s([\d_]+)/i);
        os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
    }
    else if (/ipad/i.test(ua)) {
        const m = ua.match(/os\s([\d_]+)/i);
        os = m ? `iPadOS ${m[1].replace(/_/g, '.')}` : 'iPadOS';
    }
    else if (/mac os x/i.test(ua)) {
        const m = ua.match(/mac os x\s([\d_]+)/i);
        os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    }
    else if (/linux/i.test(ua))
        os = 'Linux';
    else if (/cros/i.test(ua))
        os = 'ChromeOS';
    // ── Browser ───────────────────────────────────────────────────────────────
    let browser = 'Unbekannt', browserVersion = '';
    if (/edg\//i.test(ua)) {
        browser = 'Edge';
        const m = ua.match(/edg\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/opr\//i.test(ua)) {
        browser = 'Opera';
        const m = ua.match(/opr\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/firefox\//i.test(ua)) {
        browser = 'Firefox';
        const m = ua.match(/firefox\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/samsungbrowser/i.test(ua)) {
        browser = 'Samsung Browser';
        const m = ua.match(/samsungbrowser\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/chrome\//i.test(ua)) {
        browser = 'Chrome';
        const m = ua.match(/chrome\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/safari\//i.test(ua)) {
        browser = 'Safari';
        const m = ua.match(/version\/([\d.]+)/i);
        browserVersion = m?.[1] || '';
    }
    else if (/msie|trident/i.test(ua)) {
        browser = 'Internet Explorer';
    }
    return { deviceType, os, browser, browserVersion, raw: ua };
}
function formatDeviceForLog(device) {
    const icon = { desktop: '🖥️', mobile: '📱', tablet: '📋', unknown: '❓' }[device.deviceType];
    return `${icon} ${device.deviceType.toUpperCase()} | ${device.os} | ${device.browser} ${device.browserVersion}`;
}
