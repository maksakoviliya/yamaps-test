'use strict';

const CODES = ['PAGE_UNAVAILABLE', 'MARKUP_CHANGED', 'EMPTY_RESPONSE', 'BLOCKED', 'NOT_FOUND', 'TIMEOUT'];

class ScraperError extends Error {
    /**
     * @param {string} code One of CODES — mapped to a PHP exception class by the caller.
     * @param {string} message
     * @param {object} [details] Extra context for logs (never shown to the end user).
     */
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'ScraperError';
        this.code = CODES.includes(code) ? code : 'PAGE_UNAVAILABLE';
        this.details = details;
    }
}

module.exports = { ScraperError, CODES };
