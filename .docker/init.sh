#!/bin/bash

# Script de inicialização para o container Laravel
set -e

echo "Configurando permissões..."

# Criar diretórios necessários se não existirem
mkdir -p /usr/share/nginx/storage/logs
mkdir -p /usr/share/nginx/storage/framework/cache
mkdir -p /usr/share/nginx/storage/framework/sessions  
mkdir -p /usr/share/nginx/storage/framework/views
mkdir -p /usr/share/nginx/bootstrap/cache

# Definir permissões corretas
chown -R www-data:www-data /usr/share/nginx/storage
chown -R www-data:www-data /usr/share/nginx/bootstrap/cache
chmod -R 755 /usr/share/nginx/storage
chmod -R 755 /usr/share/nginx/bootstrap/cache

echo "Limpando cache do Laravel..."
php /usr/share/nginx/artisan config:clear || true
php /usr/share/nginx/artisan cache:clear || true
php /usr/share/nginx/artisan view:clear || true

echo "Executando migrações..."
php /usr/share/nginx/artisan migrate --force || true

echo "Iniciando Supervisor..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf 