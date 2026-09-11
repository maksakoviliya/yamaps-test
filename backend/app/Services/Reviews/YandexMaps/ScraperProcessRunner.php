<?php

declare(strict_types=1);

namespace App\Services\Reviews\YandexMaps;

use App\Exceptions\Reviews\ScraperException;
use App\Exceptions\Reviews\TimeoutException;
use Illuminate\Support\Facades\Process;
use Symfony\Component\Process\Process as SymfonyProcess;

readonly class ScraperProcessRunner
{
    /**
     * @param  array<string, string|int|bool>  $env
     */
    public function __construct(
        private string $scriptPath,
        private string $nodeBinary,
        private array $env,
        private int $timeoutSeconds,
    ) {}

    /**
     * @param  callable(int $current, ?int $total): void  $onProgress
     * @return array{business: array<string, mixed>, reviews: array<int, array<string, mixed>>, schemaWarnings: array<int, string>}
     *
     * @throws ScraperException
     */
    public function run(string $url, callable $onProgress): array
    {
        $buffer = '';
        $result = null;

        $process = Process::env($this->env)
            ->timeout($this->timeoutSeconds)
            ->run(
                [$this->nodeBinary, $this->scriptPath, $url],
                function (string $type, string $output) use (&$buffer, &$result, $onProgress): void {
                    if ($type !== SymfonyProcess::OUT) {
                        return;
                    }

                    $buffer .= $output;

                    while (($newlinePos = strpos($buffer, "\n")) !== false) {
                        $line = trim(substr($buffer, 0, $newlinePos));
                        $buffer = substr($buffer, $newlinePos + 1);

                        if ($line !== '') {
                            $this->handleLine($line, $onProgress, $result);
                        }
                    }
                }
            );

        if ($result === null) {
            throw new TimeoutException('Скрипт парсинга завершился без ответа.', [
                'exitCode' => $process->exitCode(),
                'errorOutput' => $process->errorOutput(),
            ]);
        }

        if ($result['ok'] !== true) {
            throw ScraperException::forErrorCode(
                $result['errorCode'] ?? 'PAGE_UNAVAILABLE',
                $result['message'] ?? 'Неизвестная ошибка парсинга.',
                $result['details'] ?? []
            );
        }

        return $result;
    }

    /**
     * @param  callable(int $current, ?int $total): void  $onProgress
     */
    private function handleLine(string $line, callable $onProgress, ?array &$result): void
    {
        $decoded = json_decode($line, true);

        if (! is_array($decoded) || ! isset($decoded['type'])) {
            return;
        }

        match ($decoded['type']) {
            'progress' => $onProgress((int) ($decoded['current'] ?? 0), isset($decoded['total']) ? (int) $decoded['total'] : null),
            'result' => $result = $decoded,
            default => null,
        };
    }
}
