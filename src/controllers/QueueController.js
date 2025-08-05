const { logger } = require('../config/logger');
const { getQueueStats, cleanQueues } = require('../queues');

class QueueController {
  /**
   * Busca estatísticas das filas
   * @param {object} req 
   * @param {object} res 
   */
  async getStats(req, res) {
    try {
      const stats = await getQueueStats();

      res.status(200).json({
        success: true,
        data: stats,
      });

    } catch (error) {
      logger.error('Erro ao buscar estatísticas das filas', {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Limpa filas antigas
   * @param {object} req 
   * @param {object} res 
   */
  async clean(req, res) {
    try {
      await cleanQueues();

      logger.info('Filas limpas com sucesso');

      res.status(200).json({
        success: true,
        message: 'Filas limpas com sucesso',
      });

    } catch (error) {
      logger.error('Erro ao limpar filas', {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Pausa uma fila específica
   * @param {object} req 
   * @param {object} res 
   */
  async pauseQueue(req, res) {
    try {
      const { queueName } = req.params;
      const { ordersQueue, omieQueue } = require('../queues');

      let queue;
      switch (queueName) {
        case 'orders':
          queue = ordersQueue;
          break;
        case 'omie':
          queue = omieQueue;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Nome da fila inválido. Use: orders ou omie',
          });
      }

      await queue.pause();

      logger.info(`Fila ${queueName} pausada`);

      res.status(200).json({
        success: true,
        message: `Fila ${queueName} pausada com sucesso`,
      });

    } catch (error) {
      logger.error('Erro ao pausar fila', {
        queueName: req.params.queueName,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Resume uma fila específica
   * @param {object} req 
   * @param {object} res 
   */
  async resumeQueue(req, res) {
    try {
      const { queueName } = req.params;
      const { ordersQueue, omieQueue } = require('../queues');

      let queue;
      switch (queueName) {
        case 'orders':
          queue = ordersQueue;
          break;
        case 'omie':
          queue = omieQueue;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Nome da fila inválido. Use: orders ou omie',
          });
      }

      await queue.resume();

      logger.info(`Fila ${queueName} retomada`);

      res.status(200).json({
        success: true,
        message: `Fila ${queueName} retomada com sucesso`,
      });

    } catch (error) {
      logger.error('Erro ao retomar fila', {
        queueName: req.params.queueName,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Lista jobs de uma fila específica
   * @param {object} req 
   * @param {object} res 
   */
  async getQueueJobs(req, res) {
    try {
      const { queueName } = req.params;
      const { status = 'waiting', start = 0, end = 10 } = req.query;
      const { ordersQueue, omieQueue } = require('../queues');

      let queue;
      switch (queueName) {
        case 'orders':
          queue = ordersQueue;
          break;
        case 'omie':
          queue = omieQueue;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Nome da fila inválido. Use: orders ou omie',
          });
      }

      let jobs;
      switch (status) {
        case 'waiting':
          jobs = await queue.getWaiting(parseInt(start), parseInt(end));
          break;
        case 'active':
          jobs = await queue.getActive(parseInt(start), parseInt(end));
          break;
        case 'completed':
          jobs = await queue.getCompleted(parseInt(start), parseInt(end));
          break;
        case 'failed':
          jobs = await queue.getFailed(parseInt(start), parseInt(end));
          break;
        case 'delayed':
          jobs = await queue.getDelayed(parseInt(start), parseInt(end));
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Status inválido. Use: waiting, active, completed, failed ou delayed',
          });
      }

      const jobsData = jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress(),
        delay: job.delay,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn,
      }));

      res.status(200).json({
        success: true,
        data: jobsData,
        queue: queueName,
        status,
        pagination: {
          start: parseInt(start),
          end: parseInt(end),
          count: jobs.length,
        },
      });

    } catch (error) {
      logger.error('Erro ao listar jobs da fila', {
        queueName: req.params.queueName,
        status: req.query.status,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Remove um job específico
   * @param {object} req 
   * @param {object} res 
   */
  async removeJob(req, res) {
    try {
      const { queueName, jobId } = req.params;
      const { ordersQueue, omieQueue } = require('../queues');

      let queue;
      switch (queueName) {
        case 'orders':
          queue = ordersQueue;
          break;
        case 'omie':
          queue = omieQueue;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Nome da fila inválido. Use: orders ou omie',
          });
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job não encontrado',
        });
      }

      await job.remove();

      logger.info('Job removido', {
        queueName,
        jobId,
      });

      res.status(200).json({
        success: true,
        message: 'Job removido com sucesso',
      });

    } catch (error) {
      logger.error('Erro ao remover job', {
        queueName: req.params.queueName,
        jobId: req.params.jobId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Reprocessa um job falhado
   * @param {object} req 
   * @param {object} res 
   */
  async retryJob(req, res) {
    try {
      const { queueName, jobId } = req.params;
      const { ordersQueue, omieQueue } = require('../queues');

      let queue;
      switch (queueName) {
        case 'orders':
          queue = ordersQueue;
          break;
        case 'omie':
          queue = omieQueue;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Nome da fila inválido. Use: orders ou omie',
          });
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job não encontrado',
        });
      }

      await job.retry();

      logger.info('Job reprocessado', {
        queueName,
        jobId,
      });

      res.status(200).json({
        success: true,
        message: 'Job reprocessado com sucesso',
      });

    } catch (error) {
      logger.error('Erro ao reprocessar job', {
        queueName: req.params.queueName,
        jobId: req.params.jobId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }
}

module.exports = QueueController; 