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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(config.userAgent);
        await page.setViewport({ width: 1366, height: 900 });
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        const state = attachResponseCollector(page);
        const requestedTld = topLevelDomain(url);

        await openReviewsTab(page, url, config, requestedTld);

        // Yandex renders the first page of reviews (up to 50) straight into the
        // page's SSR hydration state — no `/fetchReviews` XHR happens for it at
        // all. Only later pages (loaded on scroll) go through the network and
        // get picked up by attachResponseCollector. Without this, orgs whose
        // review count fits on one page never fire the XHR we wait for below,
        // so we'd time out despite the reviews being right there in the DOM.
        seedStateFromEmbeddedItem(state, findBusinessStackItem(await extractEmbeddedBusinessState(page)));

        if (!state.lastParams) {
            await waitForFirstReviewsResponse(page, state, config, requestedTld);
        }

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
        lastReviewsPayload: null,
        blockedPayload: null,
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

    state.lastReviewsPayload = json;

    if (isBlockedPayload(json)) {
        state.blocked = true;
        state.blockedPayload = json;

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

/**
 * Reads the SPA's own SSR hydration payload — the same state React hydrates
 * from, embedded as `<script type="application/json" class="state-view">`.
 */
async function extractEmbeddedBusinessState(page) {
    return page.evaluate(() => {
        const el = document.querySelector('script.state-view');

        if (!el) {
            return null;
        }

        try {
            return JSON.parse(el.textContent);
        } catch {
            return null;
        }
    });
}

/** Finds the business card entry in the hydration state's result stack. */
function findBusinessStackItem(embeddedState) {
    const stack = embeddedState?.stack;

    if (!Array.isArray(stack)) {
        return null;
    }

    for (const entry of stack) {
        const item = entry?.results?.items?.[0];

        if (item?.type === 'business') {
            return item;
        }
    }

    return null;
}

/**
 * Seeds collector state from the embedded business item so the rest of the
 * pipeline (wait/scroll/build) treats it exactly like data collected from
 * `/fetchReviews` — the shapes match field for field.
 */
function seedStateFromEmbeddedItem(state, item) {
    if (!item) {
        return;
    }

    if (item.id) {
        state.businessId = item.id;
    }

    if (item.ratingData) {
        state.ratingData = item.ratingData;
    }

    const reviewResults = item.reviewResults;

    if (!reviewResults) {
        return;
    }

    for (const review of reviewResults.reviews ?? []) {
        if (review?.reviewId) {
            state.reviewsById.set(review.reviewId, review);
        }
    }

    if (reviewResults.params) {
        state.lastParams = reviewResults.params;
        state.lastReviewsResponseAt = Date.now();
    }
}

/** Navigates to the given URL, then to its canonical `/reviews/` deep link. */
async function openReviewsTab(page, url, config, requestedTld) {
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
        throw new ScraperError('BLOCKED', 'Яндекс запросил капчу — запрос выглядит подозрительно для антибот-защиты.', {
            pageText: bodyText,
        });
    }
}

async function waitForFirstReviewsResponse(page, state, config, requestedTld) {
    const deadline = Date.now() + config.navigationTimeoutMs;

    while (Date.now() < deadline) {
        if (state.blocked) {
            throw new ScraperError('BLOCKED', 'Яндекс временно заблокировал автоматические запросы.', {
                response: state.blockedPayload,
            });
        }

        assertSameRegion(page, requestedTld);

        if (state.lastParams) {
            return;
        }

        await sleep(300);
    }

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');

    if (bodyText.includes('Ничего не найдено')) {
        throw new ScraperError('NOT_FOUND', 'Организация по этой ссылке не найдена.', {
            pageUrl: page.url(),
            pageText: bodyText,
        });
    }

    throw new ScraperError('TIMEOUT', 'Яндекс.Карты не ответили вовремя.', {
        pageUrl: page.url(),
        pageText: bodyText,
    });
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
            throw new ScraperError('BLOCKED', 'Яндекс временно заблокировал автоматические запросы во время скролла.', {
                response: state.blockedPayload,
            });
        }

        const sizeBefore = state.reviewsById.size;
        const lastResponseBefore = state.lastReviewsResponseAt;

        await scrollReviewsPanel(page);
        await sleep(jitter(config.minDelayMs, config.maxDelayMs));

        const gotNewData = state.lastReviewsResponseAt !== lastResponseBefore && state.reviewsById.size > sizeBefore;
        stalledScrolls = gotNewData ? 0 : stalledScrolls + 1;

        onProgress(state.reviewsById.size, target);

        if (state.lastParams && !state.lastParams.reviewsRemained) {
            break;
        }
    }
}

async function scrollReviewsPanel(page) {
    await page.evaluate(() => {
        // Yandex's own reviews panel — scrolling it is what triggers the
        // paginated `/fetchReviews?page=N` calls. Prefer it by its stable
        // class name; the generic fallback below no longer caps candidate
        // width, since the real panel legitimately takes up most of the
        // viewport (a `< 60% of window width` cap used to reject it outright,
        // so scrolling silently fell back to `window.scrollBy` — which
        // scrolls nothing, because the panel scrolls independently of the
        // window — and no page past the first ever loaded).
        //
        // The next page's XHR is only triggered once `scrollTop` reaches the
        // very bottom of the currently rendered content (a sentinel-based
        // infinite-scroll trigger, not a "scrolled far enough" heuristic) —
        // a fixed small scroll delta per step never gets there before
        // `maxStalledScrolls` gives up, so we jump straight to the bottom
        // instead. `scrollHeight` grows after each page loads, so the next
        // jump lands on the new bottom and re-triggers the next page.
        const explicit = document.querySelector('.scroll__container');

        if (explicit) {
            explicit.scrollTop = explicit.scrollHeight;

            return;
        }

        const candidates = Array.from(document.querySelectorAll('div')).filter(
            (el) => el.scrollHeight - el.clientHeight > 200 && el.clientHeight > 300
        );

        const target = candidates.sort(
            (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight)
        )[0];

        if (target) {
            target.scrollTop = target.scrollHeight;
        } else {
            window.scrollTo(0, document.body.scrollHeight);
        }
    });
}

function buildResult(business, state) {
    const reviews = Array.from(state.reviewsById.values()).map(mapReview);

    if (reviews.length === 0) {
        if (state.lastParams?.count > 0) {
            throw new ScraperError(
                'MARKUP_CHANGED',
                'Источник сообщает о наличии отзывов, но ни один не удалось распарсить — вероятно, изменилась структура ответа.',
                { response: state.lastReviewsPayload, lastParams: state.lastParams }
            );
        }

        throw new ScraperError('EMPTY_RESPONSE', 'Яндекс.Карты вернули пустой список отзывов.', {
            response: state.lastReviewsPayload,
        });
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
        authorAvatarUrl: resolveAvatarUrl(review.author?.avatarUrl),
        rating: review.rating ?? null,
        text: review.text ?? '',
        publishedAt: review.updatedTime ?? null,
    };
}

/**
 * Yandex avatar URLs are templates with a literal `{size}` placeholder
 * (e.g. `.../get-yapic/38663/0b-9/{size}`) — stored as-is they're broken
 * image links. Resolve it once here so the DB always holds a usable URL.
 */
function resolveAvatarUrl(url) {
    if (!url) {
        return null;
    }

    return url.replace('{size}', '64x64');
}

function jitter(min, max) {
    return min + Math.floor(Math.random() * (max - min));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    scrapeOrganization,
    mapReview,
    findRatingData,
    buildResult,
    toReviewsUrl,
    findBusinessStackItem,
    seedStateFromEmbeddedItem,
    resolveAvatarUrl,
};
