const Queue = require('bull');
const { queueRedisClient } = require('../config/redis');
const { logger } = require('../config/logger');

// Configuração das filas
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Criar filas
const ordersQueue = new Queue('orders', queueConfig);
const omieQueue = new Queue('omie', queueConfig);

// Configurar eventos das filas
const setupQueueEvents = (queue, queueName) => {
  queue.on('completed', (job, result) => {
    logger.info(`Job ${queueName} completed`, {
      jobId: job.id,
      jobData: job.data,
      result,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${queueName} failed`, {
      jobId: job.id,
      jobData: job.data,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job ${queueName} stalled`, {
      jobId: job.id,
      jobData: job.data,
    });
  });

  queue.on('progress', (job, progress) => {
    logger.debug(`Job ${queueName} progress`, {
      jobId: job.id,
      progress,
    });
  });
};

// Configurar eventos
setupQueueEvents(ordersQueue, 'orders');
setupQueueEvents(omieQueue, 'omie');

// Função para adicionar job à fila de pedidos
const addOrderJob = async (jobName, data, options = {}) => {
  try {
    const job = await ordersQueue.add(jobName, data, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
    
    logger.info('Job adicionado à fila de pedidos', {
      jobName,
      jobId: job.id,
      data,
    });
    
    return job;
  } catch (error) {
    logger.error('Erro ao adicionar job à fila de pedidos', {
      jobName,
      data,
      error: error.message,
    });
    throw error;
  }
};

// Função para adicionar job à fila do OMIE
const addOmieJob = async (jobName, data, options = {}) => {
  try {
    const job = await omieQueue.add(jobName, data, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
    
    logger.info('Job adicionado à fila do OMIE', {
      jobName,
      jobId: job.id,
      data,
    });
    
    return job;
  } catch (error) {
    logger.error('Erro ao adicionar job à fila do OMIE', {
      jobName,
      data,
      error: error.message,
    });
    throw error;
  }
};

// Função para obter estatísticas das filas
const getQueueStats = async () => {
  try {
    const ordersStats = {
      waiting: await ordersQueue.getWaiting(),
      active: await ordersQueue.getActive(),
      completed: await ordersQueue.getCompleted(),
      failed: await ordersQueue.getFailed(),
      delayed: await ordersQueue.getDelayed(),
    };

    const omieStats = {
      waiting: await omieQueue.getWaiting(),
      active: await omieQueue.getActive(),
      completed: await omieQueue.getCompleted(),
      failed: await omieQueue.getFailed(),
      delayed: await omieQueue.getDelayed(),
    };

    return {
      orders: {
        waiting: ordersStats.waiting.length,
        active: ordersStats.active.length,
        completed: ordersStats.completed.length,
        failed: ordersStats.failed.length,
        delayed: ordersStats.delayed.length,
      },
      omie: {
        waiting: omieStats.waiting.length,
        active: omieStats.active.length,
        completed: omieStats.completed.length,
        failed: omieStats.failed.length,
        delayed: omieStats.delayed.length,
      },
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas das filas', {
      error: error.message,
    });
    throw error;
  }
};

// Função para limpar filas
const cleanQueues = async () => {
  try {
    await ordersQueue.clean(24 * 60 * 60 * 1000, 'completed');
    await ordersQueue.clean(24 * 60 * 60 * 1000, 'failed');
    await omieQueue.clean(24 * 60 * 60 * 1000, 'completed');
    await omieQueue.clean(24 * 60 * 60 * 1000, 'failed');
    
    logger.info('Filas limpas com sucesso');
  } catch (error) {
    logger.error('Erro ao limpar filas', {
      error: error.message,
    });
    throw error;
  }
};

module.exports = {
  ordersQueue,
  omieQueue,
  addOrderJob,
  addOmieJob,
  getQueueStats,
  cleanQueues,
}; 