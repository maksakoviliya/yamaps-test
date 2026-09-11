'use strict';

const puppeteer = require('puppeteer');
const { ScraperError } = require('./ScraperError');

const FETCH_REVIEWS_PATH = '/maps/api/business/fetchReviews';
const BLOCK_MARKERS = ['showcaptcha', 'smartcaptcha', 'YANDEX_CAPTCHA'];

/**
 * @param {string} url Any link to an organization card on Yandex Maps.
 * @param {ReturnType<import('./config').loadConfig>} config
 * @param {(current: number, total: number|null) => void} onProgress
 */
async function scrapeOrganization(url, config, onProgress) {
    const browser = await puppeteer.launch({
        headless: config.headless,
        args: buildLaunchArgs(config),
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(config.userAgent);
        await page.setViewport({ width: 1366, height: 900 });
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        const state = attachResponseCollector(page);

        await openReviewsTab(page, url, config);
        await waitForFirstReviewsResponse(page, state, config);

        const business = await extractBusinessSummary(page, state);
        await scrollUntilDone(page, state, config, onProgress);

        return buildResult(business, state);
    } finally {
        await browser.close();
    }
}

function buildLaunchArgs(config) {
    const args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=ru-RU,ru',
    ];

    if (config.proxyServer) {
        args.push(`--proxy-server=${config.proxyServer}`);
    }

    return args;
}

/**
 * Buffers everything we need from network traffic as the page loads and scrolls,
 * so the rest of the script never has to re-derive signed request URLs itself.
 */
function attachResponseCollector(page) {
    const state = {
        reviewsById: new Map(),
        lastParams: null,
        businessId: null,
        ratingData: null,
        blocked: false,
        lastReviewsResponseAt: 0,
    };

    page.on('response', (response) => {
        const url = response.url();

        if (!url.includes('/maps/api/')) {
            return;
        }

        if (response.status() === 403 || response.status() === 429) {
            state.blocked = true;
        }

        if (url.includes(FETCH_REVIEWS_PATH)) {
            handleFetchReviewsResponse(response, state);
        } else {
            handleGenericApiResponse(response, state);
        }
    });

    return state;
}

async function handleFetchReviewsResponse(response, state) {
    const json = await safeJson(response);

    if (!json) {
        return;
    }

    if (isBlockedPayload(json)) {
        state.blocked = true;

        return;
    }

    const data = json.data ?? {};

    if (!Array.isArray(data.reviews)) {
        return;
    }

    for (const review of data.reviews) {
        if (review?.reviewId) {
            state.reviewsById.set(review.reviewId, review);
        }
    }

    if (data.params) {
        state.lastParams = data.params;
    }

    const businessId = new URL(response.url()).searchParams.get('businessId');

    if (businessId) {
        state.businessId = businessId;
    }

    state.lastReviewsResponseAt = Date.now();
}

async function handleGenericApiResponse(response, state) {
    if (state.ratingData) {
        return;
    }

    const json = await safeJson(response);

    if (!json) {
        return;
    }

    const found = findRatingData(json, state.businessId);

    if (found) {
        state.ratingData = found;
    }
}

/** Scans an arbitrary API payload for a `ratingData`-shaped object, wherever it lives. */
function findRatingData(node, businessId, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 6) {
        return null;
    }

    if (
        node.ratingData &&
        typeof node.ratingData.ratingValue !== 'undefined' &&
        typeof node.ratingData.ratingCount !== 'undefined'
    ) {
        if (!businessId || node.id === businessId) {
            return node.ratingData;
        }
    }

    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') {
            const found = findRatingData(value, businessId, depth + 1);

            if (found) {
                return found;
            }
        }
    }

    return null;
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function isBlockedPayload(json) {
    const text = JSON.stringify(json).toLowerCase();

    return BLOCK_MARKERS.some((marker) => text.includes(marker.toLowerCase()));
}

/** Navigates to the given URL, then to its canonical `/reviews/` deep link. */
async function openReviewsTab(page, url, config) {
    const requestedTld = topLevelDomain(url);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.navigationTimeoutMs });
    } catch (error) {
        throw new ScraperError('PAGE_UNAVAILABLE', 'Не удалось открыть страницу организации.', {
            cause: error.message,
        });
    }

    await assertNotBlocked(page);
    assertSameRegion(page, requestedTld);

    const reviewsUrl = toReviewsUrl(page.url());

    if (reviewsUrl !== page.url()) {
        try {
            await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: config.navigationTimeoutMs });
        } catch (error) {
            throw new ScraperError('PAGE_UNAVAILABLE', 'Не удалось открыть вкладку отзывов.', {
                cause: error.message,
            });
        }
    }

    await assertNotBlocked(page);
    assertSameRegion(page, requestedTld);
}

function topLevelDomain(url) {
    return new URL(url).hostname.split('.').pop();
}

/**
 * Yandex geo-redirects requests from non-CIS IPs from yandex.ru to the
 * limited international yandex.com product, silently, with no error — the
 * page loads fine but has no review data behind it. The fix is a Russian
 * proxy, so we report it the same way as a hard block.
 */
function assertSameRegion(page, requestedTld) {
    if (topLevelDomain(page.url()) !== requestedTld) {
        throw new ScraperError(
            'BLOCKED',
            'Яндекс перенаправил запрос на другой региональный домен — вероятно, IP не распознан как российский.',
            { redirectedTo: page.url() }
        );
    }
}

function toReviewsUrl(currentUrl) {
    const parsed = new URL(currentUrl);
    let pathname = parsed.pathname.replace(/\/+$/, '');

    if (!pathname.endsWith('/reviews')) {
        pathname += '/reviews';
    }

    parsed.pathname = pathname + '/';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
}

async function assertNotBlocked(page) {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const lowered = bodyText.toLowerCase();

    if (BLOCK_MARKERS.some((marker) => lowered.includes(marker.toLowerCase()))) {
        throw new ScraperError('BLOCKED', 'Яндекс запросил капчу — запрос выглядит подозрительно для антибот-защиты.');
    }
}

async function waitForFirstReviewsResponse(page, state, config) {
    const deadline = Date.now() + config.navigationTimeoutMs;

    while (Date.now() < deadline) {
        if (state.blocked) {
            throw new ScraperError('BLOCKED', 'Яндекс временно заблокировал автоматические запросы.');
        }

        if (state.lastParams) {
            return;
        }

        await sleep(300);
    }

    const notFound = await page.evaluate(() => document.body?.innerText?.includes('Ничего не найдено') ?? false);

    if (notFound) {
        throw new ScraperError('NOT_FOUND', 'Организация по этой ссылке не найдена.');
    }

    throw new ScraperError('TIMEOUT', 'Яндекс.Карты не ответили вовремя.');
}

async function extractBusinessSummary(page, state) {
    const name = await page.evaluate(() => {
        const heading = document.querySelector('h1');

        return heading?.textContent?.trim() || document.title.replace(/\s*—\s*Яндекс Карты.*$/i, '').trim() || null;
    });

    return { name, businessId: state.businessId };
}

async function scrollUntilDone(page, state, config, onProgress) {
    const target = Math.min(config.maxReviews, state.lastParams?.count ?? config.maxReviews);
    let stalledScrolls = 0;

    onProgress(state.reviewsById.size, target);

    while (state.reviewsById.size < target && stalledScrolls < config.maxStalledScrolls) {
        if (state.blocked) {
            throw new ScraperError('BLOCKED', 'Яндекс временно заблокировал автоматические запросы во время скролла.');
        }

        const sizeBefore = state.reviewsById.size;
        const lastResponseBefore = state.lastReviewsResponseAt;

        await scrollReviewsPanel(page, 1400);
        await sleep(jitter(config.minDelayMs, config.maxDelayMs));

        const gotNewData = state.lastReviewsResponseAt !== lastResponseBefore && state.reviewsById.size > sizeBefore;
        stalledScrolls = gotNewData ? 0 : stalledScrolls + 1;

        onProgress(state.reviewsById.size, target);

        if (state.lastParams && !state.lastParams.reviewsRemained) {
            break;
        }
    }
}

async function scrollReviewsPanel(page, deltaY) {
    await page.evaluate((delta) => {
        const candidates = Array.from(document.querySelectorAll('div')).filter(
            (el) =>
                el.scrollHeight - el.clientHeight > 200 &&
                el.clientHeight > 300 &&
                el.clientWidth < window.innerWidth * 0.6
        );

        const target = candidates.sort(
            (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
        )[0];

        if (target) {
            target.scrollTop += delta;
        } else {
            window.scrollBy(0, delta);
        }
    }, deltaY);
}

function buildResult(business, state) {
    const reviews = Array.from(state.reviewsById.values()).map(mapReview);

    if (reviews.length === 0) {
        if (state.lastParams?.count > 0) {
            throw new ScraperError(
                'MARKUP_CHANGED',
                'Источник сообщает о наличии отзывов, но ни один не удалось распарсить — вероятно, изменилась структура ответа.'
            );
        }

        throw new ScraperError('EMPTY_RESPONSE', 'Яндекс.Карты вернули пустой список отзывов.');
    }

    return {
        ok: true,
        business: {
            name: business.name,
            businessId: business.businessId,
            avgRating: state.ratingData?.ratingValue ?? null,
            ratingsCount: state.ratingData?.ratingCount ?? null,
            reviewsCount: state.lastParams?.count ?? reviews.length,
        },
        reviews,
        schemaWarnings: state.ratingData ? [] : ['rating_data_not_found'],
    };
}

function mapReview(review) {
    return {
        externalReviewId: review.reviewId,
        authorName: review.author?.name ?? 'Аноним',
        authorAvatarUrl: review.author?.avatarUrl ?? null,
        rating: review.rating ?? null,
        text: review.text ?? '',
        publishedAt: review.updatedTime ?? null,
    };
}

function jitter(min, max) {
    return min + Math.floor(Math.random() * (max - min));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { scrapeOrganization, mapReview, findRatingData, buildResult, toReviewsUrl };
