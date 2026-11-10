# ---------------------------------------------------------------------------
# Backend Tontine M.E.NO.JE — image autonome (PHP 8.2 + Apache + pdo_mysql).
#
#   docker build -t tontine-api backend
#   docker run --rm -p 8080:80 \
#     -v "$PWD/tontine-config.php:/var/www/html/tontine-config.php:ro" tontine-api
#   curl http://localhost:8080/api/ping
#
# La configuration n'est JAMAIS copiée dans l'image : elle est montée à
# l'emplacement lu par lib/bootstrap.php (<htdocs>/tontine-config.php) ou
# désignée par la variable d'environnement TONTINE_CONFIG.
# ---------------------------------------------------------------------------
FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers

# L'API vit dans /api, comme sur InfinityFree : les URL restent identiques.
COPY . /var/www/html/api/

# Aucun secret dans l'image, et install.php disparaît une fois l'admin créé.
RUN rm -f /var/www/html/api/config.php \
    && chown -R www-data:www-data /var/www/html/api

# Apache doit autoriser les .htaccess de api/ et transmettre l'en-tête
# Authorization à PHP (sinon 401 systématique derrière CGI/FastCGI).
RUN printf '%s\n' \
    '<Directory /var/www/html>' \
    '    AllowOverride All' \
    '    Require all granted' \
    '    SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1' \
    '</Directory>' \
    > /etc/apache2/conf-available/tontine.conf \
    && a2enconf tontine

# Production : aucune erreur PHP renvoyée au client.
RUN printf '%s\n' \
    'display_errors = Off' \
    'log_errors = On' \
    'expose_php = Off' \
    > /usr/local/etc/php/conf.d/tontine.ini

EXPOSE 80
