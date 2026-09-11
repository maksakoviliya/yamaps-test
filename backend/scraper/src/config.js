'use strict';

const DEFAULT_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

function intEnv(name, fallback) {
    const value = parseInt(process.env[name] ?? '', 10);

    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function listEnv(name) {
    const raw = process.env[name];

    if (!raw) {
        return [];
    }

    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function loadConfig() {
    const userAgents = listEnv('SCRAPER_USER_AGENTS');
    const proxies = listEnv('SCRAPER_PROXIES');

    return {
        maxReviews: intEnv('SCRAPER_MAX_REVIEWS', 600),
        navigationTimeoutMs: intEnv('SCRAPER_NAVIGATION_TIMEOUT_MS', 30_000),
        totalTimeoutMs: intEnv('SCRAPER_TOTAL_TIMEOUT_MS', 180_000),
        minDelayMs: intEnv('SCRAPER_MIN_DELAY_MS', 700),
        maxDelayMs: intEnv('SCRAPER_MAX_DELAY_MS', 1_800),
        maxStalledScrolls: intEnv('SCRAPER_MAX_STALLED_SCROLLS', 6),
        userAgent: userAgents.length > 0 ? pickRandom(userAgents) : pickRandom(DEFAULT_USER_AGENTS),
        proxyServer: proxies.length > 0 ? pickRandom(proxies) : null,
        headless: process.env.SCRAPER_HEADLESS !== 'false',
    };
}

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

module.exports = { loadConfig };
