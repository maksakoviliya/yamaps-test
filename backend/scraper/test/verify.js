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
const { mapReview, findRatingData, buildResult, toReviewsUrl } = require('../src/scrapeOrganization');

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
