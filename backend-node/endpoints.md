### Pedidos

#### `POST /api/orders/new` - Receber pedido Shopify

Recebe e processa um novo pedido vindo de um webhook do Shopify.

**Corpo da Requisição:**
```json
{
    // Objeto completo do pedido do Shopify
    "name": "#12345",
    "customer": {
        "email": "cliente@exemplo.com"
    },
    "total_price": "199.90",
    "...": "..."
}
```

**Respostas:**

- **200 OK** - Pedido adicionado às filas para processamento.
  ```json
  {
      "success": true,
      "message": "Pedido adicionado às filas de processamento",
      "shopify_id": "#12345"
  }
  ```
- **200 OK** - Pedido manual (não será processado automaticamente).
  ```json
  {
      "success": true,
      "message": "Pedido manual detectado",
      "shopify_id": "#12345"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```

---

#### `POST /api/orders/reintegrate` - Reintegrar pedido específico

Força a reintegração de um pedido específico que pode ter falhado anteriormente.

**Corpo da Requisição:**
```json
{
    "shopify_id": "#12345"
}
```

**Respostas:**

- **200 OK** - Pedido adicionado à fila de reintegração.
  ```json
  {
      "success": true,
      "message": "Pedido adicionado à fila de reintegração",
      "shopify_id": "#12345"
  }
  ```
- **400 Bad Request** - `shopify_id` não fornecido.
  ```json
  {
      "success": false,
      "message": "shopify_id é obrigatório"
  }
  ```
- **400 Bad Request** - Pedido já integrado.
  ```json
  {
      "success": false,
      "message": "Pedido já foi integrado com sucesso",
      "omie_order_id": 123456789
  }
  ```
- **404 Not Found** - Pedido não encontrado no Shopify.
  ```json
  {
      "success": false,
      "message": "Pedido não encontrado no Shopify"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```

---

#### `POST /api/orders/reintegrate-multiple` - Reintegrar múltiplos

Reintegra uma lista de pedidos de uma só vez.

**Corpo da Requisição:**
```json
{
    "shopify_ids": ["#12345", "#12346", "#12347"]
}
```

**Respostas:**

- **200 OK** - Processamento concluído com resultados individuais.
  ```json
  {
      "success": true,
      "message": "Processamento de reintegração múltipla concluído",
      "results": [
          {
              "shopify_id": "#12345",
              "status": "queued",
              "message": "Adicionado à fila de reintegração"
          },
          {
              "shopify_id": "#12346",
              "status": "error",
              "message": "Pedido não encontrado no Shopify"
          }
      ]
  }
  ```
- **400 Bad Request** - Array `shopify_ids` inválido ou vazio.
  ```json
  {
      "success": false,
      "message": "shopify_ids deve ser um array não vazio"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```


### Logs

#### `GET /api/history-logs` - Listar logs

Lista todos os logs de histórico com opção de filtros e paginação.

**Query Parameters:**
- `page` (opcional): Número da página (padrão: 1).
- `limit` (opcional): Quantidade de resultados por página (padrão: 50).
- `shopify_id` (opcional): Filtra por um ID de pedido específico (busca parcial).
- `step` (opcional): Filtra por um `step` (etapa) específico.
- `date_from` (opcional): Filtra logs a partir de uma data (formato: YYYY-MM-DD).
- `date_to` (opcional): Filtra logs até uma data (formato: YYYY-MM-DD).

**Respostas:**

- **200 OK** - Lista de logs.
  ```json
  {
      "success": true,
      "data": [
          {
              "id": 1,
              "shopify_id": "#12345",
              "step": 1,
              "log": { "message": "Iniciando processamento" },
              "created_at": "2025-07-08T10:00:00.000Z"
          }
      ],
      "pagination": {
          "page": 1,
          "limit": 50,
          "total": 100,
          "pages": 2
      }
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```

---

#### `GET /api/history-logs/order/:shopify_id` - Logs de um pedido

Busca todos os logs de histórico para um pedido específico, ordenados por etapa.

**URL Parameters:**
- `shopify_id` (obrigatório): O ID do pedido do Shopify.

**Respostas:**

- **200 OK** - Lista de logs do pedido.
  ```json
  {
      "success": true,
      "data": [
          {
              "id": 1,
              "shopify_id": "#12345",
              "step": 1,
              "log": { "message": "Iniciando processamento" },
              "created_at": "2025-07-08T10:00:00.000Z"
          },
          {
              "id": 2,
              "shopify_id": "#12345",
              "step": 2,
              "log": { "message": "Pedido aprovado" },
              "created_at": "2025-07-08T10:00:20.000Z"
          }
      ],
      "shopify_id": "#12345"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```

---

#### `GET /api/history-logs/stats` - Estatísticas de Logs

Retorna estatísticas gerais sobre os logs, como contagens totais e por etapa. A rota original era `/api/history-logs/steps`, mas a funcionalidade corresponde a `/api/history-logs/stats`.

**Query Parameters:**
- `date_from` (opcional): Filtra estatísticas a partir de uma data (formato: YYYY-MM-DD).
- `date_to` (opcional): Filtra estatísticas até uma data (formato: YYYY-MM-DD).

**Respostas:**

- **200 OK** - Objeto com as estatísticas.
  ```json
  {
      "success": true,
      "data": {
          "total_logs": 5420,
          "total_orders": 350,
          "today_logs": 85,
          "error_logs": 15,
          "successful_integrations": 330,
          "step_stats": [
              { "step": 1, "count": 350 },
              { "step": 2, "count": 350 },
              { "step": 17, "count": 330 },
              { "step": 99, "count": 15 }
          ]
      }
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```


### Filas

#### `GET /api/queues/stats` - Status das filas

Busca estatísticas e contagens de jobs para todas as filas ativas (`orders`, `omie`). A rota original era `/api/queues/status`, mas a funcionalidade corresponde a `/api/queues/stats`.

**Respostas:**

- **200 OK** - Objeto com as estatísticas das filas.
  ```json
  {
      "success": true,
      "data": {
          "orders": {
              "waiting": 10,
              "active": 2,
              "completed": 150,
              "failed": 5,
              "delayed": 1
          },
          "omie": {
              "waiting": 5,
              "active": 1,
              "completed": 120,
              "failed": 2,
              "delayed": 0
          }
      }
  }
  ```
- **500 Internal Server Error**
  ```json
  {
      "success": false,
      "message": "Erro interno do servidor",
      "error": "mensagem de erro detalhada"
  }
  ```

---

#### `GET /api/queues/:queueName/jobs` - Jobs da fila

Lista os jobs de uma fila específica (`orders` ou `omie`), com base em um status.

**URL Parameters:**
- `queueName` (obrigatório): Nome da fila (`orders` ou `omie`).

**Query Parameters:**
- `status` (opcional): Status dos jobs a serem listados. Padrão: `waiting`. Valores possíveis: `waiting`, `active`, `completed`, `failed`, `delayed`.
- `start` (opcional): Índice inicial para paginação (padrão: 0).
- `end` (opcional): Índice final para paginação (padrão: 10).

**Respostas:**

- **200 OK** - Lista de jobs.
  ```json
  {
      "success": true,
      "data": [
          {
              "id": "123",
              "name": "send-to-omie",
              "data": { "shopifyData": { "name": "#12345" } },
              "opts": { "delay": 0 },
              "progress": 0,
              "attemptsMade": 1,
              "failedReason": null,
              "finishedOn": null
          }
      ],
      "queue": "omie",
      "status": "waiting",
      "pagination": {
          "start": 0,
          "end": 10,
          "count": 1
      }
  }
  ```
- **400 Bad Request** - Nome da fila ou status inválido.
- **500 Internal Server Error**

---

#### `POST /api/queues/:queueName/jobs/:jobId/retry` - Reprocessar job

Tenta reprocessar um job específico que tenha falhado. A rota original era `/api/queues/retry/:id`, mas a implementação correta exige o nome da fila e o ID do job.

**URL Parameters:**
- `queueName` (obrigatório): Nome da fila (`orders` ou `omie`).
- `jobId` (obrigatório): O ID do job a ser reprocessado.

**Respostas:**

- **200 OK**
  ```json
  {
      "success": true,
      "message": "Job reprocessado com sucesso"
  }
  ```
- **400 Bad Request** - Nome da fila inválido.
- **404 Not Found** - Job não encontrado.
- **500 Internal Server Error**
