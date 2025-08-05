# Análise do Erro de Reintegração - Pedido 743889

## 🔍 **Resumo do Problema**

**Erro**: 404 - "Pedido não encontrado no Shopify"  
**Pedido**: 743889  
**Endpoint**: `POST /api/orders/reintegrate`  
**Data/Hora**: 2025-07-08T13:32:55.300Z  

## 📋 **Fluxo do Erro**

1. ✅ **Requisição recebida**: `POST /api/orders/reintegrate` com `shopify_id: "743889"`
2. ✅ **Verificação de pedido manual**: Não é pedido manual (consulta no banco OK)
3. ✅ **Busca na API Shopify**: `GET /orders.json?name=743889&limit=1`
4. ✅ **Resposta da API**: Status 200 (sucesso)
5. ❌ **Resultado**: Array vazio - nenhum pedido encontrado
6. ❌ **Erro retornado**: 404 - "Pedido não encontrado no Shopify"

## 🎯 **Possíveis Causas**

### **1. Pedido Não Existe no Shopify**
- O pedido "743889" pode ter sido excluído
- O número pode estar incorreto
- Pode ser de outro ambiente (dev/prod)

### **2. Problema de Formatação**
- Shopify pode usar formato diferente (ex: "#743889", "GH743889")
- Pode ter prefixo/sufixo específico

### **3. Configuração de Ambiente**
- API apontando para loja errada
- Credenciais de ambiente incorretas
- Diferença entre dev/prod

### **4. Problema de Status do Pedido**
- Pedido pode estar arquivado
- Status específico que impede a busca
- Pedido cancelado/removido

### **5. Limite de Data da API**
- Shopify pode ter limite de tempo para buscar pedidos antigos
- Pedido muito antigo para aparecer na busca

## 🔧 **Como Diagnosticar**

### **Verificar se o pedido existe:**
```bash
# Buscar diretamente na API Shopify
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
  "https://gummyhairdev.myshopify.com/admin/api/2024-07/orders.json?name=743889&limit=1"
```

### **Verificar com diferentes formatos:**
```bash
# Tentar com diferentes variações
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
  "https://gummyhairdev.myshopify.com/admin/api/2024-07/orders.json?name=%23743889&limit=1"
```

### **Buscar por status específicos:**
```bash
# Incluir pedidos arquivados/cancelados
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
  "https://gummyhairdev.myshopify.com/admin/api/2024-07/orders.json?name=743889&status=any&limit=1"
```

### **Verificar no banco local:**
```sql
-- Verificar se existe no banco local
SELECT * FROM gummy_dev.orders WHERE shopify_id = '743889';
SELECT * FROM gummy_dev.manual_orders WHERE shopify_id = '743889';
SELECT * FROM gummy_dev.history_logs WHERE shopify_id = '743889';
```

## 🛠️ **Possíveis Soluções**

### **1. Melhorar o Método de Busca**
Modificar `getOrderByName()` para buscar com diferentes parâmetros:

```javascript
async getOrderByName(orderName) {
  try {
    // Busca padrão
    let response = await this.makeRequest(`/orders.json?name=${orderName}&limit=1`);
    
    if (response.orders && response.orders.length > 0) {
      return response.orders[0];
    }

    // Busca com status=any (inclui cancelados/arquivados)
    response = await this.makeRequest(`/orders.json?name=${orderName}&status=any&limit=1`);
    
    if (response.orders && response.orders.length > 0) {
      return response.orders[0];
    }

    // Busca com # prefix
    response = await this.makeRequest(`/orders.json?name=%23${orderName}&limit=1`);
    
    if (response.orders && response.orders.length > 0) {
      return response.orders[0];
    }

    return null;
  } catch (error) {
    logger.error('Erro ao buscar pedido por nome', { orderName, error: error.message });
    throw error;
  }
}
```

### **2. Adicionar Busca por ID**
Se souber o ID interno do Shopify:

```javascript
async getOrderById(orderId) {
  try {
    const response = await this.makeRequest(`/orders/${orderId}.json`);
    return response.order;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
```

### **3. Implementar Busca Mais Robusta**
```javascript
async findOrder(identifier) {
  // Tentar por nome
  let order = await this.getOrderByName(identifier);
  if (order) return order;

  // Tentar por ID se for numérico
  if (/^\d+$/.test(identifier)) {
    order = await this.getOrderById(identifier);
    if (order) return order;
  }

  // Buscar em intervalo de datas recente
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Últimos 30 dias

  const orders = await this.getOrdersByDateRange(
    startDate.toISOString(),
    endDate.toISOString()
  );

  return orders.find(o => o.name === identifier || o.id.toString() === identifier);
}
```

## 📊 **Informações de Debug Coletadas**

```
API Request: GET /orders.json?name=743889&limit=1
API Response: Status 200
Response Body: { "orders": [] }
Store: gummyhairdev.myshopify.com
API Version: 2024-07
```

## ✅ **Próximos Passos**

1. **Verificar se o pedido existe** na loja Shopify manualmente
2. **Confirmar o ambiente** (dev vs prod)
3. **Implementar busca mais robusta** se necessário
4. **Adicionar logs mais detalhados** para futuras investigações
5. **Documentar casos similares** para referência

## 🔍 **Logs Relevantes**

```
2025-07-08T13:32:55.300Z - POST /api/orders/reintegrate
2025-07-08 10:32:55 [info]: Iniciando reintegração de pedido { "shopify_id": "743889" }
2025-07-08 10:32:55 [debug]: Executing (default): SELECT "id", "shopify_id", "created_at", "updated_at" FROM "gummy_dev"."manual_orders" AS "manual_orders" WHERE "manual_orders"."shopify_id" = '743889' LIMIT 1;
2025-07-08 10:32:56 [debug]: Shopify API Request { "endpoint": "/orders.json?name=743889&limit=1", "method": "GET", "url": "https://gummyhairdev.myshopify.com/admin/api/2024-07/orders.json?name=743889&limit=1" }
2025-07-08 10:32:56 [info]: Shopify API Request Success { "endpoint": "/orders.json?name=743889&limit=1", "method": "GET", "status": 200 }
2025-07-08 10:32:56 [info]: Pedido não encontrado por nome { "orderName": "743889" }
2025-07-08 10:32:56 [warn]: HTTP Request { "method": "POST", "url": "/reintegrate", "status": 404, "duration": "1205ms", "ip": "::1", "userAgent": "curl/8.7.1" }
```

---

**Status**: ❌ Erro identificado - Pedido não existe na API Shopify  
**Ação Requerida**: Verificar existência do pedido e implementar busca mais robusta se necessário 