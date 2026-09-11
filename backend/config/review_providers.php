<?php

declare(strict_types=1);

return [

    'active' => env('REVIEW_PROVIDER', 'yandex'),

    'providers' => [
        'yandex' => [
            'host_pattern' => '/(^|\.)yandex\.[a-z.]+$/i',
            'path_pattern' => '#/maps/#',
        ],
    ],

];
