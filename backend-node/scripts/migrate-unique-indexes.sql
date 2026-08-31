-- Migração para adicionar índices únicos
-- Data: 2024

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

-- Para produção (schema public), descomente as linhas abaixo:
/*
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
*/ 