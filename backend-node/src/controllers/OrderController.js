const { logger } = require('../config/logger');
const { Order, ManualOrder, HistoryLog } = require('../models');
const { addOrderJob, addOmieJob } = require('../queues');
const ShopifyService = require('../services/ShopifyService');
const OmieService = require('../services/OmieService');

class OrderController {
  constructor() {
    this.shopifyService = new ShopifyService();
    this.omieService = new OmieService();
  }

  /**
   * Recebe novo pedido do Shopify
   * @param {object} req 
   * @param {object} res 
   */
  async newOrder(req, res) {
    try {
      const shopifyData = req.body;
      const shopifyId = shopifyData.name;

      logger.info('Novo pedido recebido', {
        shopifyId,
        customerEmail: shopifyData.customer?.email,
        total: shopifyData.total_price,
      });

      // Verifica se é pedido manual
      const isManualOrder = await ManualOrder.findOne({
        where: { shopify_id: shopifyId },
      });

      if (isManualOrder) {
        logger.info('Pedido manual detectado, pulando processamento automático', {
          shopifyId,
        });
        return res.status(200).json({
          success: true,
          message: 'Pedido manual detectado',
          shopify_id: shopifyId,
        });
      }

      // Verifica se pedido já existe
      const existingOrder = await Order.findOne({
        where: { shopify_id: shopifyId },
      });

      if (existingOrder) {
        // Adiciona job para aprovar pedido existente
        await addOrderJob('approve-order', {
          shopifyId,
          shopifyData,
        });
      } else {
        // Adiciona jobs para criar e aprovar pedido
        await addOrderJob('create-order', {
          shopifyId,
          shopifyData,
        });

        await addOrderJob('approve-order', {
          shopifyId,
          shopifyData,
        }, {
          delay: 20000, // 20 segundos de delay
        });
      }

      // Adiciona job para enviar para OMIE
      await addOmieJob('send-to-omie', {
        shopifyData,
      });

      res.status(200).json({
        success: true,
        message: 'Pedido adicionado às filas de processamento',
        shopify_id: shopifyId,
      });

    } catch (error) {
      logger.error('Erro ao processar novo pedido', {
        error: error.message,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Reintegra um pedido específico
   * @param {object} req 
   * @param {object} res 
   */
  async reintegrateOrder(req, res) {
    try {
      const { shopify_id } = req.body;
  
      if (!shopify_id) {
        return res.status(400).json({
          success: false,
          message: 'shopify_id é obrigatório',
        });
      }
  
      logger.info('Iniciando reintegração de pedido', { shopify_id });
  
      // Verifica se é pedido manual
      const isManualOrder = await ManualOrder.findOne({
        where: { shopify_id },
      });
  
      if (isManualOrder) {
        return res.status(400).json({
          success: false,
          message: 'Pedidos manuais não podem ser reintegrados automaticamente',
        });
      }
  
      // Busca dados do pedido no Shopify
      const shopifyData = await this.shopifyService.getOrderByName(shopify_id);
      
      if (!shopifyData) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado no Shopify',
        });
      }
  
      // ✅ NOVA VALIDAÇÃO: Verifica se o pedido está pago
      if (!this.shopifyService.isOrderPaid(shopifyData)) {
        return res.status(400).json({
          success: false,
          message: 'Pedido não está pago. Status atual: ' + shopifyData.financial_status,
          financial_status: shopifyData.financial_status,
        });
      }
  
      // ✅ NOVA VALIDAÇÃO: Verifica se o pedido foi cancelado
      if (this.shopifyService.isOrderCancelled(shopifyData)) {
        return res.status(400).json({
          success: false,
          message: 'Pedido foi cancelado e não pode ser reintegrado',
          cancelled_at: shopifyData.cancelled_at,
        });
      }
  
      // Verifica se já foi integrado
      const existingLog = await HistoryLog.findOne({
        where: {
          shopify_id,
          step: 17,
        },
      });
  
      if (existingLog && existingLog.log?.codigo_pedido) {
        return res.status(400).json({
          success: false,
          message: 'Pedido já foi integrado com sucesso',
          omie_order_id: existingLog.log.codigo_pedido,
        });
      }
  
      // Remove logs antigos após step 5
      await HistoryLog.destroy({
        where: {
          shopify_id,
          step: { [require('sequelize').Op.gte]: 5 },
        },
      });
  
      // Adiciona job para reintegração
      await addOmieJob('reintegrate-order', {
        shopifyData,
      });
  
      res.status(200).json({
        success: true,
        message: 'Pedido adicionado à fila de reintegração',
        shopify_id,
      });
  
    } catch (error) {
      logger.error('Erro ao reintegrar pedido', {
        shopify_id: req.body.shopify_id,
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
   * Reintegra múltiplos pedidos
   * @param {object} req 
   * @param {object} res 
   */
  async reintegrateMultipleOrders(req, res) {
    try {
      const { shopify_ids } = req.body;
  
      if (!Array.isArray(shopify_ids) || shopify_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'shopify_ids deve ser um array não vazio',
        });
      }
  
      logger.info('Iniciando reintegração múltipla', {
        count: shopify_ids.length,
        shopify_ids,
      });
  
      const results = [];
  
      for (const shopify_id of shopify_ids) {
        try {
          // Busca dados do pedido no Shopify
          const shopifyData = await this.shopifyService.getOrderByName(shopify_id);
          
          if (!shopifyData) {
            results.push({
              shopify_id,
              status: 'error',
              message: 'Pedido não encontrado no Shopify',
            });
            continue;
          }
  
          // ✅ NOVA VALIDAÇÃO: Verifica se o pedido está pago
          if (!this.shopifyService.isOrderPaid(shopifyData)) {
            results.push({
              shopify_id,
              status: 'error',
              message: 'Pedido não está pago. Status: ' + shopifyData.financial_status,
              financial_status: shopifyData.financial_status,
            });
            continue;
          }
  
          // ✅ NOVA VALIDAÇÃO: Verifica se o pedido foi cancelado
          if (this.shopifyService.isOrderCancelled(shopifyData)) {
            results.push({
              shopify_id,
              status: 'error',
              message: 'Pedido foi cancelado',
              cancelled_at: shopifyData.cancelled_at,
            });
            continue;
          }
  
          // Adiciona job para reintegração
          await addOmieJob('reintegrate-order', {
            shopifyData,
          });
  
          results.push({
            shopify_id,
            status: 'queued',
            message: 'Adicionado à fila de reintegração',
          });
  
        } catch (error) {
          logger.error('Erro ao processar pedido na reintegração múltipla', {
            shopify_id,
            error: error.message,
          });
  
          results.push({
            shopify_id,
            status: 'error',
            message: error.message,
          });
        }
      }
  
      res.status(200).json({
        success: true,
        message: 'Processamento de reintegração múltipla concluído',
        results,
      });
  
    } catch (error) {
      logger.error('Erro na reintegração múltipla', {
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
   * Lista pedidos com filtros
   * @param {object} req 
   * @param {object} res 
   */
  async listOrders(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        shopify_id,
        omie_id,
        status,
      } = req.query;

      const where = {};
      
      if (shopify_id) {
        where.shopify_id = { [require('sequelize').Op.like]: `%${shopify_id}%` };
      }
      
      if (omie_id) {
        where.omie_id = omie_id;
      }

      if (status) {
        where[status] = true;
      }

      const orders = await Order.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']],
      });

      res.status(200).json({
        success: true,
        data: orders.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: orders.count,
          pages: Math.ceil(orders.count / parseInt(limit)),
        },
      });

    } catch (error) {
      logger.error('Erro ao listar pedidos', {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message,
      });
    }
  }

  /**
   * Busca detalhes de um pedido
   * @param {object} req 
   * @param {object} res 
   */
  async getOrderDetails(req, res) {
    try {
      const { shopify_id } = req.params;

      const order = await Order.findOne({
        where: { shopify_id },
        include: [
          {
            model: HistoryLog,
            as: 'historyLogs',
            order: [['created_at', 'ASC']],
          },
        ],
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Pedido não encontrado',
        });
      }

      res.status(200).json({
        success: true,
        data: order,
      });

    } catch (error) {
      logger.error('Erro ao buscar detalhes do pedido', {
        shopify_id: req.params.shopify_id,
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

module.exports = OrderController;