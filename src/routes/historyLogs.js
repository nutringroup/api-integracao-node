const express = require('express');
const router = express.Router();
const HistoryLogController = require('../controllers/HistoryLogController');

// Instanciar controlador
const historyLogController = new HistoryLogController();

// Rotas para logs de histórico
router.get('/', historyLogController.listLogs.bind(historyLogController));
router.get('/grouped', historyLogController.getGroupedLogs.bind(historyLogController));
router.get('/errors', historyLogController.listLogsWithErrors.bind(historyLogController));
router.get('/errors/grouped', historyLogController.getGroupedLogsWithErrors.bind(historyLogController));
router.get('/stats', historyLogController.getLogStats.bind(historyLogController));
router.get('/order/:shopify_id', historyLogController.getOrderLogs.bind(historyLogController));
router.post('/', historyLogController.createLog.bind(historyLogController));
router.delete('/clean', historyLogController.cleanOldLogs.bind(historyLogController));

module.exports = router;