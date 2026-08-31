const express = require('express');
const router = express.Router();

// Importar rotas específicas
const orderRoutes = require('./orders');
const historyLogRoutes = require('./historyLogs');
const queueRoutes = require('./queues');

// Middleware para log de requisições
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Rota de health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Registrar rotas específicas
router.use('/orders', orderRoutes);
router.use('/history-logs', historyLogRoutes);
router.use('/queues', queueRoutes);

// Rota padrão para endpoints não encontrados
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
  });
});

module.exports = router; 