#!/bin/bash

# Script para executar migração de índices únicos
# Uso: ./scripts/run-migration.sh [dev|prod]

ENVIRONMENT=${1:-dev}

# Carregar variáveis de ambiente
if [ "$ENVIRONMENT" = "dev" ]; then
    if [ -f .env-dev ]; then
        export $(cat .env-dev | xargs)
        echo "🔧 Executando migração no ambiente de DESENVOLVIMENTO"
    else
        echo "❌ Arquivo .env-dev não encontrado"
        exit 1
    fi
elif [ "$ENVIRONMENT" = "prod" ]; then
    if [ -f .env ]; then
        export $(cat .env | xargs)
        echo "🚀 Executando migração no ambiente de PRODUÇÃO"
    else
        echo "❌ Arquivo .env não encontrado"
        exit 1
    fi
else
    echo "❌ Ambiente inválido. Use: dev ou prod"
    exit 1
fi

# Verificar se as variáveis necessárias estão definidas
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Variáveis de ambiente do banco não encontradas"
    echo "Necessário: DB_HOST, DB_USER, DB_NAME"
    exit 1
fi

echo "📊 Conectando ao banco: $DB_HOST/$DB_NAME"

# Executar migração
if [ "$ENVIRONMENT" = "dev" ]; then
    # Para desenvolvimento, usar apenas as queries do schema gummy_dev
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Remover duplicatas existentes na tabela clients antes de criar o índice único
WITH duplicates AS (
    SELECT cpf, MIN(id) as keep_id
    FROM gummy_dev.clients 
    GROUP BY cpf 
    HAVING COUNT(*) > 1
)
DELETE FROM gummy_dev.clients 
WHERE id NOT IN (SELECT keep_id FROM duplicates)
AND cpf IN (SELECT cpf FROM duplicates);

-- Criar índice único para CPF na tabela clients
CREATE UNIQUE INDEX IF NOT EXISTS clients_cpf_unique 
ON gummy_dev.clients (cpf);

-- Remover duplicatas existentes na tabela orders antes de criar o índice único
WITH duplicates AS (
    SELECT shopify_id, MIN(id) as keep_id
    FROM gummy_dev.orders 
    GROUP BY shopify_id 
    HAVING COUNT(*) > 1
)
DELETE FROM gummy_dev.orders 
WHERE id NOT IN (SELECT keep_id FROM duplicates)
AND shopify_id IN (SELECT shopify_id FROM duplicates);

-- Criar índice único para shopify_id na tabela orders
CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_id_unique 
ON gummy_dev.orders (shopify_id);

\echo '✅ Migração de desenvolvimento concluída com sucesso!'
EOF
elif [ "$ENVIRONMENT" = "prod" ]; then
    # Para produção, usar as queries do schema public
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Remover duplicatas existentes na tabela clients (produção)
WITH duplicates AS (
    SELECT cpf, MIN(id) as keep_id
    FROM public.clients 
    GROUP BY cpf 
    HAVING COUNT(*) > 1
)
DELETE FROM public.clients 
WHERE id NOT IN (SELECT keep_id FROM duplicates)
AND cpf IN (SELECT cpf FROM duplicates);

-- Criar índice único para CPF na tabela clients (produção)
CREATE UNIQUE INDEX IF NOT EXISTS clients_cpf_unique 
ON public.clients (cpf);

-- Remover duplicatas existentes na tabela orders (produção)
WITH duplicates AS (
    SELECT shopify_id, MIN(id) as keep_id
    FROM public.orders 
    GROUP BY shopify_id 
    HAVING COUNT(*) > 1
)
DELETE FROM public.orders 
WHERE id NOT IN (SELECT keep_id FROM duplicates)
AND shopify_id IN (SELECT shopify_id FROM duplicates);

-- Criar índice único para shopify_id na tabela orders (produção)
CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_id_unique 
ON public.orders (shopify_id);

\echo '✅ Migração de produção concluída com sucesso!'
EOF
fi

if [ $? -eq 0 ]; then
    echo "🎉 Migração executada com sucesso!"
    echo "📋 Próximos passos:"
    echo "   1. Reiniciar a aplicação Node.js"
    echo "   2. Testar a criação de pedidos"
    echo "   3. Verificar se não há mais duplicatas"
else
    echo "❌ Erro ao executar migração"
    exit 1
fi 