#!/usr/bin/env node
'use strict';

const { loadConfig } = require('./src/config');
const { scrapeOrganization } = require('./src/scrapeOrganization');
const { ScraperError } = require('./src/ScraperError');
const { emitProgress, emitResult } = require('./src/ndjson');

async function main() {
    const url = process.argv[2];

    if (!url) {
        emitResult({ ok: false, errorCode: 'PAGE_UNAVAILABLE', message: 'Не передана ссылка на организацию.' });
        process.exit(1);
    }

    const config = loadConfig();

    try {
        const result = await withTimeout(
            scrapeOrganization(url, config, emitProgress),
            config.totalTimeoutMs
        );

        emitResult(result);
    } catch (error) {
        if (error instanceof ScraperError) {
            emitResult({ ok: false, errorCode: error.code, message: error.message, details: error.details });
        } else {
            emitResult({ ok: false, errorCode: 'PAGE_UNAVAILABLE', message: error.message });
        }

        process.exit(1);
    }
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new ScraperError('TIMEOUT', 'Превышен общий лимит времени на парсинг.')), ms)
        ),
    ]);
}

main();
