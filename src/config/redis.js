const { createClient } = require('redis');
require('dotenv').config();

// Configuração do cliente Redis principal
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: 0,
});

// Configuração do cliente Redis para filas
const queueRedisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: 1, // Usa DB diferente para filas
});

// Eventos do cliente principal
redisClient.on('connect', () => {
  console.log('🔌 Conectando ao Redis...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis conectado e pronto para uso.');
});

redisClient.on('error', (err) => {
  console.error('❌ Erro no Redis:', err.message);
});

redisClient.on('end', () => {
  console.log('🔌 Conexão com Redis encerrada.');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Reconectando ao Redis...');
});

// Eventos do cliente de filas
queueRedisClient.on('connect', () => {
  console.log('🔌 Conectando ao Redis para filas...');
});

queueRedisClient.on('ready', () => {
  console.log('✅ Redis para filas conectado e pronto para uso.');
});

queueRedisClient.on('error', (err) => {
  console.error('❌ Erro no Redis para filas:', err.message);
});

queueRedisClient.on('end', () => {
  console.log('🔌 Conexão com Redis para filas encerrada.');
});

queueRedisClient.on('reconnecting', () => {
  console.log('🔄 Reconectando ao Redis para filas...');
});

// Função para testar conexão
const connectRedis = async () => {
  try {
    await redisClient.connect();
    await queueRedisClient.connect();
    
    // Testa operações básicas
    await redisClient.setEx('test_key', 10, 'test_value');
    const testValue = await redisClient.get('test_key');
    
    if (testValue === 'test_value') {
      console.log('✅ Teste de conexão Redis bem-sucedido.');
      await redisClient.del('test_key');
    } else {
      throw new Error('Falha no teste de operação Redis');
    }
  } catch (error) {
    console.error('❌ Erro ao testar conexão Redis:', error.message);
    throw error;
  }
};

// Função para fechar conexões graciosamente
const closeConnections = async () => {
  try {
    await redisClient.quit();
    await queueRedisClient.quit();
    console.log('🔌 Conexões Redis fechadas.');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões Redis:', error.message);
  }
};

// Gerenciamento de eventos de processo
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT. Fechando conexões Redis...');
  await closeConnections();
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM. Fechando conexões Redis...');
  await closeConnections();
});

module.exports = {
  redisClient,
  queueRedisClient,
  connectRedis,
  closeConnections,
}; 