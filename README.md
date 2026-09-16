# Отзывы и рейтинг организаций на Яндекс.Картах

Небольшой сервис: авторизация → вставить ссылку на карточку организации в Яндекс.Картах → получить средний рейтинг, точные числа оценок/отзывов и постраничный список всех отзывов (до ~600), которые Яндекс не отдаёт по официальному API.

Стек: **Laravel 12 (API) + Sanctum SPA-аутентификация** на бэкенде, **Vue 3 (Composition API) + TypeScript** на фронте, парсер — **Node.js + Puppeteer**, запускаемый бэкендом как подпроцесс и выполняемый в очереди (`queue:work`).

## Содержание

- [Быстрый старт (Docker)](#быстрый-старт-docker)
- [Запуск без Docker](#запуск-без-docker)
- [Переменные окружения](#переменные-окружения)
- [Архитектура](#архитектура)
- [Подход к парсингу и обход защиты](#подход-к-парсингу-и-обход-защиты)
- [Доп. требования: ответы по пунктам 1–5](#доп-требования-ответы-по-пунктам-1–5)
- [Тесты](#тесты)

## Быстрый старт (Docker)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
```

- API: `http://localhost:8000`
- Фронтенд поднимается отдельно (Vite dev-сервер в Docker не описан — см. ниже): `cd frontend && npm install && npm run dev` → `http://localhost:5173`
- Сид-пользователь: `demo@example.com` / `password` (переопределяется `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` в `backend/.env`)

`docker-compose.yml` поднимает:

| Сервис | Назначение |
|---|---|
| `app` (php-fpm) | API-приложение; тот же образ, что у `queue-worker` — в нём уже установлены Node.js и системный Chromium для Puppeteer |
| `queue-worker` | `php artisan queue:work --queue=scraping,default --tries=3` — выполняет парсинг асинхронно |
| `nginx` | реверс-прокси на `app`, порт `8000` |
| `mysql` | БД, наружу — `3307` (чтобы не конфликтовать с локальным MySQL) |
| `redis` | очередь + сессии, наружу — `6380` |

Один и тот же `Dockerfile` используется и для `app`, и для `queue-worker` — так подпроцесс `node scrape.js`, который вызывает Laravel, гарантированно находит тот же Node/Chromium в обоих контейнерах.

Фронтенд не завёрнут в Docker намеренно — это SPA, собираемая статика (`npm run build`) отдаётся откуда угодно (тот же nginx, Vercel, Netlify); при разработке удобнее гонять Vite dev-сервер напрямую.

## Запуск без Docker

Нужны PHP 8.4, Composer, Node.js 22+, MySQL/SQLite, Redis (или `QUEUE_CONNECTION=sync`/`SESSION_DRIVER=file` для совсем упрощённого локального запуска без Redis).

```bash
# backend
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve                 # http://localhost:8000

# очередь — отдельный процесс, обязателен для парсинга
php artisan queue:work --queue=scraping,default

# сам скрапер — отдельные node_modules
cd scraper && npm install
```

```bash
# frontend
cd frontend
cp .env.example .env
npm install
npm run dev                       # http://localhost:5173
```

Проверить парсер изолированно (без Laravel, печатает NDJSON в stdout):

```bash
cd backend/scraper
node scrape.js "https://yandex.ru/maps/org/.../..."
```

## Переменные окружения

### `backend/.env`

| Переменная | Назначение |
|---|---|
| `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | учётка, создаваемая `UserSeeder` |
| `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS` | откуда разрешён stateful SPA-логин (CORS + Sanctum) |
| `DB_*`, `REDIS_*` | подключение к MySQL/Redis; при `docker compose` хосты переопределяются самим compose-файлом |
| `SCRAPER_NODE_BINARY` | путь к `node` (по умолчанию просто `node` из `$PATH`) |
| `SCRAPER_NAVIGATION_TIMEOUT_MS` / `SCRAPER_TOTAL_TIMEOUT_MS` | таймаут на открытие страницы / на весь прогон |
| `SCRAPER_MIN_DELAY_MS` / `SCRAPER_MAX_DELAY_MS` | джиттер задержки между скроллами (анти-бан) |
| `SCRAPER_MAX_STALLED_SCROLLS` | сколько скроллов подряд без новых данных считать концом ленты |
| `SCRAPER_USER_AGENTS` | список UA через запятую — один выбирается случайно на прогон |
| `SCRAPER_PROXIES` | список `host:port` через запятую — ротация прокси на прогон |
| `SCRAPER_HEADLESS` | `false` — открыть браузер с UI для отладки |
| `SCRAPER_RATE_LIMIT_PER_MINUTE` | лимит запуска джобов парсинга в минуту (throttle очереди) |

### `frontend/.env`

| Переменная | Назначение |
|---|---|
| `VITE_API_URL` | адрес backend API (`http://localhost:8000`) |

## Архитектура

```
Vue SPA  ──HTTP (Sanctum cookie)──▶  Laravel API
                                        │
                              ConnectOrganization (Action)
                                        │  dispatch
                                        ▼
                         ParseOrganizationReviews (Queue Job)
                                        │
                         ReviewsProviderInterface (DI)
                                        │
                      YandexMapsReviewsProvider ──▶ ScraperProcessRunner
                                        │            (Process::run, читает
                                        │             NDJSON построчно)
                                        ▼
                         node backend/scraper/scrape.js <url>
                                        │  puppeteer
                                        ▼
                              Яндекс.Карты (браузер)
                                        │
                         OrganizationSyncService (upsert + snapshot)
                                        ▼
                              MySQL: organizations / reviews /
                                     organization_snapshots
```

Слои на бэкенде:

- **Controllers** ([`app/Http/Controllers/Api`](backend/app/Http/Controllers/Api)) — только принимают запрос и делегируют Action’у, никакой логики.
- **Actions** ([`app/Actions`](backend/app/Actions)) — один класс = один сценарий использования (`ConnectOrganization`, `ListReviews`, `LoginUser`…).
- **Services** ([`app/Services/Reviews`](backend/app/Services/Reviews)) — вся работа с внешним источником спрятана за `ReviewsProviderInterface`. Контроллер и Job ничего не знают про Puppeteer, Node или конкретно Яндекс — только про интерфейс `fetch(string $url, callable $onProgress): ReviewsFetchResult`. Добавить 2ГИС — значит написать `TwoGisReviewsProvider` и не трогать остальной код.
- **Job + очередь** ([`app/Jobs/ParseOrganizationReviews.php`](backend/app/Jobs/ParseOrganizationReviews.php)) — сам парсинг никогда не выполняется внутри HTTP-запроса.

## Подход к парсингу и обход защиты

**Выбранный подход: headless-браузер (Puppeteer), который не парсит DOM, а перехватывает внутренний JSON-запрос карточки** (`GET .../maps/api/business/fetchReviews`) через `page.on('response')`.

Почему не «чистый» разбор внутренних запросов напрямую через `fetch`/`axios`, в обход браузера:

- у запроса `fetchReviews` есть подписанные параметры (`csrfToken`, сессионные куки, антибот-отпечаток), которые генерируются JS-рантаймом страницы и завязаны на характеристики браузера (canvas/webgl fingerprint и т.д.) — их проще получить *из* настоящего браузера, чем реверс-инжинирить и поддерживать отдельно;
- страница сама подгружает следующие страницы отзывов при скролле — не нужно вручную разбираться с пагинацией/токенами запроса, достаточно проскроллить панель и подождать response;
- рейтинг (`ratingData`) не всегда лежит в том же ответе, что и отзывы — он приходит другим служебным запросом карточки; вручную собирать все нужные эндпоинты и их авторизацию дороже, чем один раз проскроллить страницу и слушать всё, что прилетает.

Почему не «чистый» разбор DOM (обычный HTML-скрейпинг вёрстки):

- вёрстка Яндекс.Карт — сгенерированные css-классы (`.tPmg`, и т.п.), которые меняются гораздо чаще, чем контракт внутреннего API; JSON-ответ семантический (`reviewId`, `rating`, `author.name`) и куда стабильнее визуальной разметки.

Плюсы выбранного подхода:
- данные приходят уже структурированными (не нужен HTML-парсинг → меньше хрупкого кода);
- один и тот же браузерный контекст решает и антибот-защиту (реальный JS-рантаж, реальные заголовки/куки), и пагинацию (скролл);
- один явный маркер поломки — если в ответе нет ожидаемых полей, это сразу видно.

Минусы и риски:
- медленнее и тяжелее, чем прямой HTTP-запрос (нужен полноценный Chromium-процесс на каждый прогон — заметно на масштабе ~50 филиалов, см. ниже про очередь);
- хрупкость не к вёрстке, а к *форме JSON-контракта* (Яндекс может переименовать поле `reviewId` → `id`, изменить структуру `ratingData`) — на это есть отдельная защита (см. пункт 1 ниже);
- headless-браузеры детектируются антибот-системами по фингерпринтам (`navigator.webdriver`, `chrome.runtime`, аномалии canvas/WebGL) — мы это частично закрываем (`--disable-blink-features=AutomationControlled`, подмена `navigator.webdriver`, реалистичный UA/viewport), но это гонка вооружений, а не гарантия.

Как парсер понимает, что источник изменился (пункт 1 подробнее в разделе ниже): `scrapeOrganization.js` не просто «не нашёл данные → вернул пустоту». Если сервер сообщает, что отзывов должно быть N (`params.count > 0`), но локально не распарсился ни один — это осознанно отдельная ошибка `MARKUP_CHANGED`, отличная от «отзывов действительно нет» (`EMPTY_RESPONSE`). Аналогично отдельно различаются: капча/бан (`BLOCKED`), недоступная страница (`PAGE_UNAVAILABLE`), несуществующая организация (`NOT_FOUND`), таймаут (`TIMEOUT`). Каждый код превращается в свой класс исключения на PHP-стороне ([`ScraperException::forErrorCode`](backend/app/Exceptions/Reviews/ScraperException.php)) и пишется в отдельный лог-канал `storage/logs/scraper.log`.

### Кэширование / что грузить целиком, а что подкачивать

Все ~600 отзывов вытягиваются **один раз за прогон парсинга** (не по одному отзыву на HTTP-запрос к Яндексу) и сохраняются в MySQL. Дальше фронтенд обращается только к своему бэкенду: `GET /api/organizations/{id}/reviews?page=N` отдаёт 50 отзывов из БД через обычную Eloquent-пагинацию.

Альтернатива «тянуть все 600 из Яндекса при каждом открытии страницы» отброшена сразу — это дорого (полный проход браузера ради того, чтобы показать одну страницу), медленно для пользователя (секунды/десятки секунд на один визит) и увеличивает риск бана пропорционально числу открытий карточки пользователями, а не числу реальных изменений в отзывах. Кэш на стороне бэка (БД) — единственный вариант, совместимый с «постраничная навигация без перезагрузки»: без него каждое переключение страницы означало бы новый прогон Puppeteer.

Обновление кэша — по явному запросу пользователя (повторное сохранение той же ссылки → повторный `ParseOrganizationReviews`) либо могло бы быть по расписанию (`php artisan schedule` + переодическая постановка джобов) — в реализации это не подключено, но `Organization::status` и `last_parsed_at` уже дают всё нужное, чтобы такой планировщик добавить одной командой.

## Доп. требования: ответы по пунктам 1–5

### 1. Устойчивость к смене разметки

Реализовано (не только описано): парсер различает шесть кодов ошибок (`PAGE_UNAVAILABLE`, `MARKUP_CHANGED`, `EMPTY_RESPONSE`, `BLOCKED`, `NOT_FOUND`, `TIMEOUT`), см. [`ScraperError`](backend/scraper/src/ScraperError.js) и [`buildResult`](backend/scraper/src/scrapeOrganization.js). Ключевой случай — `MARKUP_CHANGED`: если ответ API сообщает `count > 0` (отзывы есть), но ни один объект отзыва не удалось смэпить в валидную структуру, это классифицируется как «источник сломался», а не как «отзывов нет». Отдельно: если `ratingData` не нашёлся вообще ни в одном перехваченном ответе, в результат добавляется `schemaWarnings: ['rating_data_not_found']` — организация всё равно сохраняется (с отзывами), но предупреждение уходит в лог, чтобы поломку одного из двух источников данных заметили до того, как рейтинги массово станут `null`.

Ошибка долетает до пользователя человекочитаемым сообщением (см. [`lang/ru/scraper.php`](backend/lang/ru/scraper.php) и `Organization.status = failed / blocked_retry`), а в `storage/logs/scraper.log` — с кодом, деталями (`details`) и номером попытки, специально в отдельном канале, чтобы не искать иголку в общем логе Laravel.

Что не реализовано, но стоило бы добавить при выходе в прод: автоматический алерт (Slack/e-mail) при первом `MARKUP_CHANGED` на любой организации — сейчас об этом узнают только по логу или по статусу `failed` в интерфейсе.

### 2. Обоснование подхода к парсингу

См. раздел [«Подход к парсингу и обход защиты»](#подход-к-парсингу-и-обход-защиты) выше — сравнение с чистым разбором внутренних JSON-запросов и с HTML-скрейпингом, плюсы/минусы/риски.

### 3. Масштаб и фоновая обработка

Реализовано: парсинг **никогда** не выполняется внутри HTTP-запроса. `ConnectOrganization` только создаёт/обновляет запись со статусом `pending` и диспатчит [`ParseOrganizationReviews`](backend/app/Jobs/ParseOrganizationReviews.php) в очередь `scraping` (обрабатывается `queue-worker`-контейнером, отдельным от `app`).

- **Прогресс**: колбэк `onProgress(current, total)` из скрапера на каждом скролле обновляет `organizations.progress_current/progress_total`; фронт поллит `GET /api/organizations/{id}` раз в 2 секунды, пока статус «в процессе» ([`useOrganization.ts`](frontend/src/composables/useOrganization.ts)), и рисует прогресс-бар.
- **Повторные попытки**: `tries = 3`, экспоненциальный `backoff = [30, 120, 300]` секунд. `BlockedException` (капча/429/403) специально помечена так, чтобы Laravel **ретраил** джобу (статус `blocked_retry`); `MarkupChangedException`/`NotFoundException` — так, чтобы джоба **сразу фейлилась** без бессмысленных повторов (проблема не в везении, а в реальном изменении источника или отсутствии организации).
- **Без гонок**: `WithoutOverlapping($organization->id)` — если пользователь дважды нажмёт «подключить» одну и ту же карточку, второй запуск не стартует поверх первого; на уровне API это же проверяется в `ConnectOrganization::__invoke` (см. `test_resubmitting_the_same_business_while_still_in_progress_does_not_duplicate_or_requeue`).
- **Масштаб на ~50 филиалов**: каждая организация — независимая джоба в одной очереди; добавить обработку 50 карточек = продиспатчить 50 джоб (например, из Artisan-команды `foreach`), они обработаются `queue-worker`’ами параллельно (несколько воркеров/`--processes` в Supervisor) в пределах общего рейт-лимита ниже.

### 4. Анти-бан на объёме

Реализовано частично, остальное описано:

- **Троттлинг**: `RateLimiter::for('yandex-scrape', fn () => Limit::perMinute(config('scraper.rate_limit_per_minute')))` в [`AppServiceProvider`](backend/app/Providers/AppServiceProvider.php) — джоба использует `RateLimited` middleware, так что даже если в очереди разом окажется 50 задач, реальных запусков Chromium к Яндексу будет не больше `SCRAPER_RATE_LIMIT_PER_MINUTE` в минуту.
- **Задержки/джиттер**: между скроллами внутри одного прогона — случайная пауза `SCRAPER_MIN_DELAY_MS…SCRAPER_MAX_DELAY_MS`, а не фиксированный интервал (см. `jitter()` в [`scrapeOrganization.js`](backend/scraper/src/scrapeOrganization.js)) — паттерн запросов не выглядит как ровный бот-цикл.
- **Ротация UA/прокси**: `SCRAPER_USER_AGENTS`/`SCRAPER_PROXIES` — списки через запятую, один элемент выбирается случайно на **каждый прогон** ([`config.js`](backend/scraper/src/config.js)); это ротация «между организациями», не «между запросами внутри одной сессии» (внутри одного прогона логично оставаться одним и тем же браузерным отпечатком — смена UA/IP посреди одной сессии сама по себе подозрительна для антибота).
- **Реакция на «нас забанили»**: `BLOCKED` (капча, 403/429) не считается фатальной ошибкой — организация уходит в статус `blocked_retry`, джоба ретраится с задержкой `backoff` (до 3 попыток). При исчерпании попыток — `failed`, но с явным сообщением «Яндекс временно заблокировал…», а не generic-ошибкой.

Чего не хватает для реального продакшена на 50 филиалов и это стоит описать как следующий шаг: (а) *эскалирующий* бэкофф на уровне пула прокси в целом — если забанен один прокси/IP, а не конкретная организация, стоит на время выводить его из ротации, а не просто ретраить ту же джобу с тем же (возможно, забаненным) IP; (b) отдельный сервис/API мониторинга долей `BLOCKED`-ответов, чтобы понижать `rate_limit_per_minute` автоматически, а не только через ручную правку `.env`.

### 5. Идемпотентность и история изменений

Реализовано: повторный парсинг той же организации не создаёт дублей.

- **Отзывы** — `Review::upsert(..., uniqueBy: ['organization_id', 'external_review_id'], update: [...])` в [`OrganizationSyncService::upsertReviews`](backend/app/Services/Reviews/OrganizationSyncService.php); уникальный индекс `(organization_id, external_review_id)` закреплён на уровне миграции. Перед апдейтом сравнивается старое/новое значение `rating`/`text` — если отзыв реально изменился, это логируется («отзыв изменился при повторном парсинге»).
- **Организация** — `Organization::firstOrNew(['yandex_business_id' => ...])` в [`ConnectOrganization`](backend/app/Actions/Organization/ConnectOrganization.php): повторная отправка той же ссылки (в т. ч. другим пользователем) переиспользует существующую запись, а не плодит вторую карточку той же организации.
- **История «было → стало»** — таблица `organization_snapshots` (миграция [`create_organization_snapshots_table`](backend/database/migrations/2026_09_11_121405_create_organization_snapshots_table.php)): снимок `avg_rating/ratings_count/reviews_count` + JSON `diff_summary` вида `{"ratings_count": {"from": 100, "to": 150}}` пишется **только когда агрегаты реально изменились** (или это первый прогон) — см. [`recordSnapshotIfChanged`](backend/app/Services/Reviews/OrganizationSyncService.php). Повторный парсинг с теми же данными не плодит снимки (покрыто тестом `test_reparsing_with_the_same_data_does_not_duplicate_reviews_or_snapshots`). Эндпоинт `GET /api/organizations/{id}/snapshots` отдаёт всю историю, фронт рисует её в [`SnapshotHistory.vue`](frontend/src/components/SnapshotHistory.vue).

Что не реализовано: снимки/дифф только для агрегатов организации (рейтинг/счётчики), не для содержимого отдельных отзывов (изменение текста/рейтинга конкретного отзыва только логируется в `scraper.log`, не хранится как отдельная версия строки). Для полноценной истории по каждому отзыву модель данных расширяется прямолинейно: таблица `review_revisions (review_id, rating, text, captured_at)`, заполняемая в том же месте, где сейчас пишется лог — архитектурно ничего менять не нужно, это аддитивное изменение.

## Тесты

```bash
cd backend
composer install
php artisan test --compact       # 25 тестов, все проходят
vendor/bin/pint --test           # стиль кода
```

```bash
cd backend/scraper
npm install
npm test                          # офлайн-проверки чистых функций парсинга на фикстурах реального ответа Яндекса
```

```bash
cd frontend
npm install
npm run build                     # vue-tsc + vite build
```

Фича-тесты покрывают: доступ только для авторизованных, валидацию ссылки (`ValidBusinessUrl`), дедупликацию организации по `yandex_business_id`, диспатч и статусы джобы парсинга (успех / блокировка+ретрай / смена разметки / повтор без дублей / изменение агрегатов → новый снимок), пагинацию отзывов по 50.
