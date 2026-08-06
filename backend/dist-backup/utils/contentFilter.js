"use strict";
/**
 * PingR Content Safety Filter v4
 *
 * Erkennt ALLE Umgehungsversuche durch:
 * 1. Zeichennormalisierung (Leerzeichen, Sonderzeichen, Leet-Speak entfernen)
 * 2. Regex-Muster für Teilnamen und Abkürzungen
 * 3. Kontext-sensitive Zwei-Begriff-Prüfung
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterContent = filterContent;
exports.filterFilename = filterFilename;
exports.filterGroupName = filterGroupName;
// ── Normalisierung: ALLE Trennzeichen + Leet-Speak entfernen ─────────────────
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
        .replace(/8/g, 'b').replace(/!/g, 'i').replace(/@/g, 'a')
        .replace(/\$/g, 's').replace(/\|/g, 'i').replace(/\+/g, 't')
        // Kyrillische Lookalikes
        .replace(/а/g, 'a').replace(/е/g, 'e').replace(/о/g, 'o').replace(/р/g, 'p')
        // ALLE Leerzeichen, Sonderzeichen, Trennzeichen entfernen
        .replace(/[\s\-_.,!?*#'"\/\\|(){}\[\]<>^~`´°·•–—«»„""''‚\u200b\u00ad]/g, '')
        .replace(/[^a-z]/g, '');
}
function fuzzyAny(text, terms) {
    const norm = normalize(text);
    for (const t of terms) {
        if (norm.includes(normalize(t)))
            return t;
    }
    return null;
}
// ── Heil-Hitler-Detektor (dediziert, alle Varianten) ─────────────────────────
function hasNaziGreeting(text) {
    const norm = normalize(text);
    const rawLow = text.toLowerCase();
    // 1. Normalisiert-kombiniert
    if (norm.includes('heilhitler'))
        return true;
    if (norm.includes('hitlerheil'))
        return true;
    if (norm.includes('siegheil'))
        return true;
    if (norm.includes('sigheil'))
        return true;
    if (norm.includes('heilderfuhrer') || norm.includes('heildenfuhrer'))
        return true;
    // 2. heil + fuhrer/führer (normalisiert)
    if (norm.includes('heil') && (norm.includes('fuhrer') || norm.includes('fhrer')))
        return true;
    // 3. heil + hitler-Varianten (auch teilweise)
    if (norm.includes('heil') && (norm.includes('hitl') || norm.includes('htler') || norm.includes('itler')))
        return true;
    // 4. Regex für original Text (Leerzeichen erlaubt)
    if (/heil\s+h(itler?|tler|!|i|1)?(\s|$|\.)/i.test(rawLow))
        return true;
    if (/heil\s+(h?itler|htler|itler)/i.test(rawLow))
        return true;
    if (/heil\s+(dem\s+)?(f[uü]h?rer?|fuhrer)/i.test(rawLow))
        return true;
    if (/s(ie)?g\s+heil/i.test(rawLow))
        return true;
    if (/h\s*e\s*i\s*l\s+h\s*i\s*t\s*l\s*e\s*r/i.test(rawLow))
        return true;
    return false;
}
// ── TIER 1A: § 184b StGB — CSAM ─────────────────────────────────────────────
const CSAM = [
    'kinderporno', 'kinderpornogr', 'childporno', 'childporn', 'csam',
    'childabuse', 'kindermissbrauch', 'pedophil', 'paedophil', 'pädophil',
    'jailbait', 'lolicon', 'shotacon', 'childlover', 'childmolest',
];
// ── TIER 1B: § 86a StGB — weitere verbotene Symbole ─────────────────────────
const EXTREMISM = [
    'hakenkreuz', 'swastika',
    'whitepower', 'weissepower', 'whitesupremacy',
    'aryannation',
    'nsdap', 'sturmabteilung', 'schutzstaffel',
    'drittes reich', 'drittesreich', 'nsreich',
    'endlösung', 'endloesung', 'endlosung',
    'untermensch', 'untermenschen',
    'rassenschande', 'judenstern',
    'judensau', 'saujude',
    'auslanderraus',
    'kukluxklan', 'kkk',
];
// Zahlencode 88 = HH = Heil Hitler (nur allein stehend)
function has88(text) {
    return /(?:^|\s|[^0-9])88(?:\s|[^0-9]|$)/.test(text) && text.trim().length <= 12;
}
// ── TIER 1C: § 129a StGB — Terrorplanung ─────────────────────────────────────
const TERROR = [
    'terroranschlagplan', 'anschlagvorbereitung', 'bombenanschlagplan',
    'selbstmordattentat', 'terrorzelle', 'terrorismusfinanz',
    'alqaida', 'islamischerstaatrekrut', 'isisrekrut',
];
// ── Cybermobbing / Selbstverletzung ──────────────────────────────────────────
const HARASSMENT = [
    'töte dich', 'bring dich um', 'bringdichumindieserwelt',
    'erhäng dich', 'erhänge dich',
    'spring vom dach', 'spring von', 'schneide dich',
    'niemand mag dich', 'alle hassen dich',
    'mach schluss mit deinem leben',
];
// ── Tier 2: Zur Review ────────────────────────────────────────────────────────
const SUSPICIOUS = [
    'volksverhetzung', 'vergase', 'vergasen',
    'todallenj', 'todjuden',
];
function isSpam(text) {
    if (/(.)\1{19,}/.test(text))
        return true;
    if (/(https?:\/\/\S+\s*){6,}/.test(text))
        return true;
    return false;
}
// ── HAUPT-EXPORT ─────────────────────────────────────────────────────────────
function filterContent(text) {
    if (!text?.trim())
        return { blocked: false, flagged: false };
    if (fuzzyAny(text, CSAM))
        return {
            blocked: true, flagged: false, category: 'child_safety', severity: 'critical',
            reason: 'Dieser Inhalt verstößt gegen § 184b StGB.',
            legalBasis: '§ 184b StGB',
        };
    if (hasNaziGreeting(text))
        return {
            blocked: true, flagged: false, category: 'extremism_certain', severity: 'critical',
            reason: 'Dieser Inhalt enthält nach § 86a StGB verbotenes Material.',
            legalBasis: '§ 86a StGB',
        };
    if (has88(text))
        return {
            blocked: true, flagged: false, category: 'extremism_certain', severity: 'critical',
            reason: 'Dieser Inhalt enthält nach § 86a StGB verbotenes Material.',
            legalBasis: '§ 86a StGB',
        };
    if (fuzzyAny(text, EXTREMISM))
        return {
            blocked: true, flagged: false, category: 'extremism_certain', severity: 'critical',
            reason: 'Dieser Inhalt enthält nach § 86a StGB verbotenes Material.',
            legalBasis: '§ 86a StGB',
        };
    if (fuzzyAny(text, TERROR))
        return {
            blocked: true, flagged: false, category: 'terrorism_certain', severity: 'critical',
            reason: 'Terrorplanung (§ 129a StGB).',
            legalBasis: '§ 129a StGB',
        };
    if (fuzzyAny(text, HARASSMENT))
        return {
            blocked: true, flagged: false, category: 'suspicious', severity: 'high',
            reason: 'Cybermobbing oder Aufrufe zur Selbstverletzung.',
            legalBasis: '§ 241 / § 130 StGB',
        };
    if (fuzzyAny(text, SUSPICIOUS))
        return {
            blocked: false, flagged: true, category: 'suspicious', severity: 'medium',
            reason: 'Zur manuellen Prüfung markiert.', legalBasis: '§ 130 StGB',
        };
    if (isSpam(text))
        return {
            blocked: true, flagged: false, category: 'spam', severity: 'low',
            reason: 'Spam erkannt.',
        };
    return { blocked: false, flagged: false };
}
function filterFilename(filename) {
    const dangerous = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.jar', '.msi', '.scr', '.pif', '.com'];
    if (dangerous.some(ext => filename.toLowerCase().endsWith(ext)))
        return { blocked: true, flagged: false, reason: 'Dateityp nicht erlaubt.', category: 'spam', severity: 'medium' };
    return { blocked: false, flagged: false };
}
function filterGroupName(name) {
    if (!name?.trim() || name.trim().length < 2)
        return { blocked: true, flagged: false, reason: 'Name zu kurz.', category: 'spam', severity: 'low' };
    const r = filterContent(name);
    if (r.blocked)
        return { ...r, reason: `Gruppenname nicht erlaubt: ${r.reason}` };
    return { blocked: false, flagged: false };
}
