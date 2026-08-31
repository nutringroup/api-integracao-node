# Dockerfile - VERSÃO FINAL REFORÇADA E DEFINITIVA

FROM wyveo/nginx-php-fpm:php82

# --- CAMADA 1: LIMPEZA AGRESSIVA DE REPOSITÓRIOS ---
# Removemos os repositórios de TODAS as localizações possíveis para garantir um início limpo.
# Esta separação em uma camada RUN própria é ESSENCIAL.
RUN \
    rm -f /etc/apt/sources.list.d/*.list && \
    # O comando 'sed' abaixo remove as linhas que contêm 'nginx.org' ou 'sury.org' do arquivo principal.
    sed -i '/nginx.org/d' /etc/apt/sources.list && \
    sed -i '/sury.org/d' /etc/apt/sources.list


# --- CAMADA 2: INSTALAÇÃO CORRETA ---
# Agora que temos certeza que o ambiente está limpo, executamos a instalação.
RUN \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        ca-certificates \
        apt-transport-https \
        lsb-release && \
    \
    # Adiciona o repositório Sury PHP da forma segura
    curl -fsSL https://packages.sury.org/php/apt.gpg | gpg --dearmor -o /usr/share/keyrings/sury-php-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/sury-php-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main" > /etc/apt/sources.list.d/sury-php.list && \
    \
    # Adiciona o repositório do Nginx da forma segura
    curl -fsSL https://nginx.org/keys/nginx_signing.key | gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/mainline/debian/ $(lsb_release -sc) nginx" > /etc/apt/sources.list.d/nginx.list && \
    \
    # Atualiza as listas e instala os pacotes finais
    apt-get update && \
    apt-get install -y --no-install-recommends \
        supervisor \
        php8.2-mongodb && \
    \
    # Limpa o cache
    rm -rf /var/lib/apt/lists/*

# Copia o código da aplicação
COPY . /usr/share/nginx

# Copia o arquivo .env específico para Docker
COPY .env-docker /usr/share/nginx/.env

# Copia o arquivo de configuração do Supervisor
COPY .docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Copia o script de inicialização
COPY .docker/init.sh /usr/local/bin/init.sh

# Cria os diretórios necessários e define as permissões corretas
RUN mkdir -p /var/log/supervisor && \
    mkdir -p /usr/share/nginx/storage/logs && \
    mkdir -p /usr/share/nginx/storage/framework/cache && \
    mkdir -p /usr/share/nginx/storage/framework/sessions && \
    mkdir -p /usr/share/nginx/storage/framework/views && \
    mkdir -p /usr/share/nginx/bootstrap/cache && \
    chown -R www-data:www-data /var/log/supervisor && \
    chown -R www-data:www-data /usr/share/nginx/storage && \
    chown -R www-data:www-data /usr/share/nginx/bootstrap/cache && \
    chmod -R 755 /usr/share/nginx/storage && \
    chmod -R 755 /usr/share/nginx/bootstrap/cache && \
    chmod +x /usr/local/bin/init.sh

# Define o script de inicialização como o processo principal
CMD ["/usr/local/bin/init.sh"]
