const express = require('express');
const router = express.Router();
const QueueController = require('../controllers/QueueController');

// Instanciar controlador
const queueController = new QueueController();

// Rotas para filas
router.get('/stats', queueController.getStats.bind(queueController));
router.post('/clean', queueController.clean.bind(queueController));
router.post('/:queueName/pause', queueController.pauseQueue.bind(queueController));
router.post('/:queueName/resume', queueController.resumeQueue.bind(queueController));
router.get('/:queueName/jobs', queueController.getQueueJobs.bind(queueController));
router.delete('/:queueName/jobs/:jobId', queueController.removeJob.bind(queueController));
router.post('/:queueName/jobs/:jobId/retry', queueController.retryJob.bind(queueController));

module.exports = router; 