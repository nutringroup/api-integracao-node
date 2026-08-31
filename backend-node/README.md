# Central Gummy API - Node.js

API Node.js para integração entre Shopify e OMIE ES (Espírito Santo), desenvolvida para substituir a versão Laravel mantendo todas as funcionalidades essenciais.

## 🚀 Funcionalidades

- ✅ **Integração Shopify**: Recebe pedidos via webhook
- ✅ **Integração OMIE ES**: Apenas Espírito Santo (PE removido)
- ✅ **Sistema de Filas**: Processamento assíncrono com Bull/Redis
- ✅ **Logs Detalhados**: Rastreamento completo do processo
- ✅ **Validações**: CPF/CNPJ, endereços, produtos
- ✅ **Segurança**: Rate limiting, CORS, validações
- ✅ **Multi-ambiente**: Dev, Homolog, Produção

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- PostgreSQL >= 12
- Redis >= 6.0
- NPM ou Yarn

## 🔧 Instalação

1. **Clone e acesse o diretório**:
```bash
cd backend-node
```

2. **Instale as dependências**:
```bash
npm install
# ou use o script
./scripts/run.sh install
```

3. **Configure o ambiente**:
```bash
# Para desenvolvimento
cp .env-dev .env

# Para homologação
cp .env-homolog .env

# Para produção
cp .env-prod .env
```

## 🗄️ Configuração do Banco

### PostgreSQL
```sql
-- Criar banco de dados
CREATE DATABASE nutringroup;

-- Criar usuário
CREATE USER gummy WITH PASSWORD 'Somosrosa@#2024';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE nutringroup TO gummy;
```

### Tabelas Principais
- `orders` - Pedidos Shopify
- `clients` - Clientes OMIE
- `products` - Produtos com SKU
- `historylog` - Logs de processo
- `manual_orders` - Pedidos manuais

## 🚀 Execução

### Usando o Script (Recomendado)
```bash
# Desenvolvimento
./scripts/run.sh dev

# Produção
./scripts/run.sh start prod

# Workers apenas
./scripts/run.sh worker prod

# Testes
./scripts/run.sh test

# Verificar código
./scripts/run.sh lint
```

### Usando NPM Diretamente
```bash
# Desenvolvimento
npm run dev

# Produção
npm start

# Workers
npm run worker

# Testes
npm test
```

## 🔄 Fluxo de Integração

1. **Shopify** → Webhook → `POST /api/orders/new`
2. **Validação** → Dados do pedido e cliente
3. **Fila Orders** → Processamento assíncrono
4. **Verificação OMIE** → Cliente existe?
5. **Criação/Atualização** → Cliente no OMIE
6. **Fila OMIE** → Envio do pedido
7. **Logs** → Rastreamento completo

## 📊 Endpoints da API

### Pedidos
- `POST /api/orders/new` - Receber pedido Shopify
- `POST /api/orders/reintegrate` - Reintegrar pedido específico
- `POST /api/orders/reintegrate-multiple` - Reintegrar múltiplos

### Logs
- `GET /api/history-logs` - Listar logs
- `GET /api/history-logs/order/:id` - Logs de um pedido
- `GET /api/history-logs/steps` - Logs por step

### Filas
- `GET /api/queues/status` - Status das filas
- `GET /api/queues/jobs` - Jobs ativos
- `POST /api/queues/retry/:id` - Reprocessar job

## 🔒 Segurança

- **Rate Limiting**: 100-500 req/15min (por ambiente)
- **CORS**: Origens específicas por ambiente
- **Helmet**: Headers de segurança
- **Validação**: Joi para entrada de dados
- **Logs**: Auditoria completa

## 🏗️ Arquitetura

```
src/
├── config/          # Configurações (DB, Redis, Logger)
├── models/          # Modelos Sequelize
├── services/        # Serviços (OMIE, Shopify)
├── jobs/            # Jobs das filas
├── queues/          # Configuração das filas
├── workers/         # Workers para processamento
├── controllers/     # Controladores da API
├── routes/          # Rotas da API
└── server.js        # Servidor principal
```

## 🔧 Configuração de Ambiente

### Desenvolvimento (.env-dev)
- PostgreSQL local ou remoto
- Redis local
- Logs detalhados
- CORS liberado para localhost

### Homologação (.env-homolog)
- PostgreSQL de homologação
- Redis de homologação
- Logs moderados
- CORS para domínios de homolog

### Produção (.env-prod)
- PostgreSQL de produção
- Redis de produção
- Logs otimizados
- CORS restrito
- Métricas habilitadas

## 🔍 Monitoramento

### Logs
- Console (desenvolvimento)
- Arquivo (homolog/produção)
- Rotação diária
- Níveis: debug, info, warn, error

### Filas
- Dashboard Bull Board
- Métricas de performance
- Retry automático
- Dead letter queue

## 📈 Performance

- **Conexões DB**: Pool de 10 conexões
- **Filas**: Concorrência configurável
- **Cache**: Redis para sessões
- **Compressão**: Gzip habilitado
- **Rate Limiting**: Proteção contra spam

## 🧪 Testes

```bash
# Todos os testes
npm test

# Testes em watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 🔄 Migração do Laravel

### Removido
- ❌ Sistema de mensagens
- ❌ Integração OMIE PE
- ❌ Dependências Laravel

### Mantido
- ✅ Estrutura do banco
- ✅ Lógica de integração OMIE
- ✅ Steps de log (8, 9, 10, 17, 26, 30, 61, 63, 64, 99)
- ✅ Validações CPF/CNPJ
- ✅ Sistema de filas equivalente

## 🚨 Troubleshooting

### Erro de Conexão PostgreSQL
```bash
# Verificar se o PostgreSQL está rodando
pg_isready -h 104.251.212.234 -p 5432

# Testar conexão
psql -h 104.251.212.234 -p 5432 -U gummy -d nutringroup
```

### Erro de Conexão Redis
```bash
# Verificar Redis
redis-cli -h redis -p 6379 -a "Somosrosa@#2024" ping
```

### Logs de Debug
```bash
# Aumentar nível de log
export LOG_LEVEL=debug

# Executar com logs detalhados
npm run dev
```

## 📝 Licença

MIT License - Central Gummy

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

---

**Desenvolvido para Central Gummy** 🍬 