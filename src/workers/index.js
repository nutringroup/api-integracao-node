const { ordersQueue, omieQueue } = require('../queues');
const { logger } = require('../config/logger');
const SendToOmieJob = require('../jobs/SendToOmieJob');

// Instanciar jobs
const sendToOmieJob = new SendToOmieJob();

// Configurar processamento da fila de pedidos
ordersQueue.process('create-order', async (job) => {
  logger.info('Processando job create-order', {
    jobId: job.id,
    data: job.data,
  });
  
  // Aqui você pode adicionar lógica para criar pedido no banco
  // Por enquanto, apenas retorna sucesso
  return { status: 'order-created' };
});

ordersQueue.process('approve-order', async (job) => {
  logger.info('Processando job approve-order', {
    jobId: job.id,
    data: job.data,
  });
  
  // Aqui você pode adicionar lógica para aprovar pedido
  // Por enquanto, apenas retorna sucesso
  return { status: 'order-approved' };
});

// Configurar processamento da fila do OMIE
omieQueue.process('send-to-omie', async (job) => {
  logger.info('Processando job send-to-omie', {
    jobId: job.id,
    shopifyId: job.data.shopifyData?.name,
  });
  
  try {
    const result = await sendToOmieJob.process(job);
    logger.info('Job send-to-omie processado com sucesso', {
      jobId: job.id,
      result,
    });
    return result;
  } catch (error) {
    logger.error('Erro ao processar job send-to-omie', {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
});

// Configurar processamento de reintegração
omieQueue.process('reintegrate-order', async (job) => {
  logger.info('Processando job reintegrate-order', {
    jobId: job.id,
    data: job.data,
  });
  
  try {
    // Reutilizar a mesma lógica do send-to-omie
    const result = await sendToOmieJob.process(job);
    logger.info('Job reintegrate-order processado com sucesso', {
      jobId: job.id,
      result,
    });
    return result;
  } catch (error) {
    logger.error('Erro ao processar job reintegrate-order', {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
});

// Configurar concorrência
ordersQueue.concurrency = 5; // Processar até 5 jobs de pedidos simultaneamente
omieQueue.concurrency = 3;   // Processar até 3 jobs do OMIE simultaneamente

logger.info('Workers configurados e iniciados', {
  ordersQueueConcurrency: ordersQueue.concurrency,
  omieQueueConcurrency: omieQueue.concurrency,
});

module.exports = {
  ordersQueue,
  omieQueue,
}; 