const { sequelize, SCHEMA } = require('../config/database');
const { logger } = require('../config/logger');
const Order = require('./Order');
const Client = require('./Client');
const Product = require('./Product');
const HistoryLog = require('./HistoryLog');
const ManualOrder = require('./ManualOrder');

// Definir associações
Order.belongsTo(Client, { 
  foreignKey: 'omie_client', 
  as: 'client',
  constraints: false // Desabilitar constraints para evitar problemas com dados existentes
});
Client.hasMany(Order, { 
  foreignKey: 'omie_client', 
  as: 'orders',
  constraints: false
});

HistoryLog.belongsTo(Order, { 
  foreignKey: 'shopify_id', 
  targetKey: 'shopify_id', 
  as: 'order',
  constraints: false
});
Order.hasMany(HistoryLog, { 
  foreignKey: 'shopify_id', 
  sourceKey: 'shopify_id', 
  as: 'historyLogs',
  constraints: false
});

// Sincronizar modelos
const syncModels = async () => {
  try {
    logger.info(`🔄 Sincronizando modelos no schema: ${SCHEMA}`);
    
    // Sincronizar sem alter para evitar problemas com dados existentes
    await sequelize.sync({ 
      force: false, // Não dropar tabelas existentes
      alter: false  // Não alterar estrutura de tabelas existentes
    });
    
    logger.info('✅ Modelos sincronizados com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao sincronizar modelos:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Order,
  Client,
  Product,
  HistoryLog,
  ManualOrder,
  syncModels,
}; 