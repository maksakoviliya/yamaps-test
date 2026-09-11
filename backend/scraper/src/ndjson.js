'use strict';

/** One JSON object per stdout line — the PHP side reads these as they arrive. */
function emit(line) {
    process.stdout.write(JSON.stringify(line) + '\n');
}

function emitProgress(current, total) {
    emit({ type: 'progress', current, total });
}

function emitResult(payload) {
    emit({ type: 'result', ...payload });
}

module.exports = { emitProgress, emitResult };
