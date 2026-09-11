#!/bin/sh
# Forces an isolated test environment: inside the docker app container,
# APP_ENV/SESSION_DRIVER/DB_* are already real process env vars, which
# phpunit.xml's <env force="true"> does not reliably override there.
export APP_ENV=testing
export SESSION_DRIVER=array
export DB_CONNECTION=sqlite
export DB_DATABASE=:memory:
export CACHE_STORE=array
export QUEUE_CONNECTION=sync
export BROADCAST_CONNECTION=null
export MAIL_MAILER=array

exec vendor/bin/phpunit "$@"
