'use strict';

// Offline sanity check for the pure parsing functions, using response shapes
// captured from a real Yandex Maps session (see README for how they were
// obtained). Run with: node test/verify.js
//
// This sandbox's outbound IP geo-redirects yandex.ru -> yandex.com (see
// assertSameRegion in scrapeOrganization.js), so a live end-to-end run isn't
// possible here without a Russian proxy — this fixture-based check is the
// next best thing for verifying the parsing logic itself.

const assert = require('node:assert/strict');
const {
    mapReview,
    findRatingData,
    buildResult,
    toReviewsUrl,
    findBusinessStackItem,
    seedStateFromEmbeddedItem,
} = require('../src/scrapeOrganization');

const realReview = {
    reviewId: '7bAdihCvDkYDnPv040XPxtmpoK81-b1',
    businessId: '1364580496',
    author: {
        name: 'Ася А',
        avatarUrl: 'https://avatars.mds.yandex.net/get-yapic/36777/0b-5/{size}',
    },
    text: 'В кофемании очень нравится кофе, пью его ежедневно.',
    rating: 3,
    updatedTime: '2026-04-20T18:09:42.166Z',
};

const realSearchItemWithRating = {
    id: '32296030962',
    title: 'Кофейное Дерево',
    ratingData: { ratingCount: 195, ratingValue: 5, reviewCount: 128 },
};

const realParams = {
    offset: 0,
    limit: 50,
    count: 2179,
    loadedReviewsCount: 50,
    page: 1,
    totalPages: 44,
    reviewsRemained: 2129,
};

// The first page of reviews (up to 50) never hits the network — it's baked
// into `<script class="state-view">`, Yandex's own SSR hydration payload.
// Shape captured from a real org page's embedded state.
const realBusinessStackItem = {
    type: 'business',
    id: realSearchItemWithRating.id,
    ratingData: realSearchItemWithRating.ratingData,
    reviewResults: {
        reviews: [realReview],
        params: realParams,
    },
};

const realEmbeddedState = {
    stack: [{ results: { items: [realBusinessStackItem] } }],
};

test('mapReview extracts the fields the DB needs', () => {
    const mapped = mapReview(realReview);

    assert.equal(mapped.externalReviewId, '7bAdihCvDkYDnPv040XPxtmpoK81-b1');
    assert.equal(mapped.authorName, 'Ася А');
    assert.equal(mapped.rating, 3);
    assert.equal(mapped.publishedAt, '2026-04-20T18:09:42.166Z');
});

test('mapReview tolerates a missing author', () => {
    const mapped = mapReview({ reviewId: 'x', rating: 5, text: 'ok' });

    assert.equal(mapped.authorName, 'Аноним');
    assert.equal(mapped.authorAvatarUrl, null);
});

test('findRatingData locates ratingData nested arbitrarily deep, matched by id', () => {
    const payload = { data: { items: [{ other: true }, realSearchItemWithRating] } };

    const found = findRatingData(payload, '32296030962');

    assert.deepEqual(found, realSearchItemWithRating.ratingData);
});

test('findRatingData ignores a ratingData whose id does not match the target business', () => {
    const payload = { data: { items: [realSearchItemWithRating] } };

    assert.equal(findRatingData(payload, 'some-other-id'), null);
});

test('buildResult assembles the final payload from collected state', () => {
    const state = {
        reviewsById: new Map([[realReview.reviewId, realReview]]),
        lastParams: realParams,
        ratingData: realSearchItemWithRating.ratingData,
    };

    const result = buildResult({ name: 'Кофемания', businessId: '1364580496' }, state);

    assert.equal(result.ok, true);
    assert.equal(result.business.avgRating, 5);
    assert.equal(result.business.ratingsCount, 195);
    assert.equal(result.business.reviewsCount, 2179);
    assert.equal(result.reviews.length, 1);
});

test('buildResult reports MARKUP_CHANGED when the source claims reviews exist but none parsed', () => {
    const state = { reviewsById: new Map(), lastParams: { count: 2179 }, ratingData: null };

    assert.throws(() => buildResult({ name: 'x', businessId: '1' }, state), /MARKUP_CHANGED|изменилась структура/);
});

test('buildResult reports EMPTY_RESPONSE when the source itself reports zero reviews', () => {
    const state = { reviewsById: new Map(), lastParams: { count: 0 }, ratingData: null };

    assert.throws(() => buildResult({ name: 'x', businessId: '1' }, state), /EMPTY_RESPONSE|пустой список/);
});

test('toReviewsUrl appends /reviews/ to a bare org URL and strips query params', () => {
    assert.equal(
        toReviewsUrl('https://yandex.ru/maps/org/kofemaniya/1364580496/?ll=37.5,55.7&z=16'),
        'https://yandex.ru/maps/org/kofemaniya/1364580496/reviews/'
    );
});

test('toReviewsUrl is a no-op on an already-canonical reviews URL', () => {
    assert.equal(
        toReviewsUrl('https://yandex.ru/maps/org/kofemaniya/1364580496/reviews/'),
        'https://yandex.ru/maps/org/kofemaniya/1364580496/reviews/'
    );
});

test('findBusinessStackItem finds the business entry in the hydration state stack', () => {
    assert.deepEqual(findBusinessStackItem(realEmbeddedState), realBusinessStackItem);
});

test('findBusinessStackItem skips non-business stack entries', () => {
    const state = { stack: [{ results: { items: [{ type: 'geo' }] } }, { results: { items: [realBusinessStackItem] } }] };

    assert.deepEqual(findBusinessStackItem(state), realBusinessStackItem);
});

test('findBusinessStackItem returns null when there is no embedded state', () => {
    assert.equal(findBusinessStackItem(null), null);
    assert.equal(findBusinessStackItem({ stack: [] }), null);
});

test('seedStateFromEmbeddedItem seeds reviews, rating and pagination params straight from SSR data', () => {
    const state = { reviewsById: new Map(), lastParams: null, businessId: null, ratingData: null, lastReviewsResponseAt: 0 };

    seedStateFromEmbeddedItem(state, realBusinessStackItem);

    assert.equal(state.businessId, realSearchItemWithRating.id);
    assert.deepEqual(state.ratingData, realSearchItemWithRating.ratingData);
    assert.deepEqual(state.lastParams, realParams);
    assert.equal(state.reviewsById.get(realReview.reviewId), realReview);
    assert.ok(state.lastReviewsResponseAt > 0);
});

test('seedStateFromEmbeddedItem is a no-op when no business item was found', () => {
    const state = { reviewsById: new Map(), lastParams: null, businessId: null, ratingData: null, lastReviewsResponseAt: 0 };

    seedStateFromEmbeddedItem(state, null);

    assert.equal(state.lastParams, null);
    assert.equal(state.reviewsById.size, 0);
});

function test(name, fn) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`FAIL - ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}
