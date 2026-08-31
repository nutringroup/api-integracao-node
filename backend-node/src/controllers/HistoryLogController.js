const { logger } = require('../config/logger');
const { HistoryLog } = require('../models');
const { Op } = require('sequelize');

class HistoryLogController {
  /**
   * Lista logs de histórico com filtros
   * @param {object} req 
   * @param {object} res 
   */
  async listLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        shopify_id,
        step,
        date_from,
        date_to,
      } = req.query;

      const where = {};
      
      if (shopify_id) {
        where.shopify_id = { [Op.like]: `%${shopify_id}%` };
      }
      
      if (step) {
        where.step = step;
      }

      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) {
          where.created_at[Op.gte] = new Date(date_from);
        }
        if (date_to) {
          where.created_at[Op.lte] = new Date(date_to);
        }
      }

      const logs = await HistoryLog.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']],
      });

      res.status(200).json({
        success: true,
        data: logs.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: logs.count,
          pages: Math.ceil(logs.count / parseInt(limit)),
        },
      });

    } catch (error) {
      logger.error('Erro ao listar logs de histórico', {
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
   * Busca logs de um pedido específico
   * @param {object} req 
   * @param {object} res 
   */
  async getOrderLogs(req, res) {
    try {
      const { shopify_id } = req.params;

      const logs = await HistoryLog.findAll({
        where: { shopify_id },
        order: [['step', 'ASC'], ['created_at', 'ASC']],
      });

      res.status(200).json({
        success: true,
        data: logs,
        shopify_id,
      });

    } catch (error) {
      logger.error('Erro ao buscar logs do pedido', {
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

  /**
   * Busca logs agrupados por shopify_id
   * @param {object} req 
   * @param {object} res 
   */
  async getGroupedLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        shopify_id,
        date_from,
        date_to,
      } = req.query;

      const where = {};
      
      if (shopify_id) {
        where.shopify_id = { [Op.like]: `%${shopify_id}%` };
      }

      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) {
          where.created_at[Op.gte] = new Date(date_from);
        }
        if (date_to) {
          where.created_at[Op.lte] = new Date(date_to);
        }
      }

      // Busca todos os shopify_ids únicos
      const uniqueShopifyIds = await HistoryLog.findAll({
        attributes: ['shopify_id'],
        where,
        group: ['shopify_id'],
        order: [['shopify_id', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      const shopifyIds = uniqueShopifyIds.map(log => log.shopify_id);

      // Busca logs para cada shopify_id
      const groupedLogs = [];
      for (const id of shopifyIds) {
        const logs = await HistoryLog.findAll({
          where: { shopify_id: id },
          order: [['step', 'ASC'], ['created_at', 'ASC']],
        });

        groupedLogs.push({
          shopify_id: id,
          logs,
        });
      }

      // Conta total de shopify_ids únicos
      const totalCount = await HistoryLog.count({
        distinct: true,
        col: 'shopify_id',
        where,
      });

      res.status(200).json({
        success: true,
        data: groupedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit)),
        },
      });

    } catch (error) {
      logger.error('Erro ao buscar logs agrupados', {
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

  async listLogsWithErrors(req, res) {
    try {
      const { page = 1, limit = 50, shopify_id, date_from, date_to } = req.query;

      // Query para buscar logs de erro, excluindo pedidos que foram integrados com sucesso após o último erro
      let query = `
        WITH error_orders AS (
          SELECT DISTINCT shopify_id,
                 MAX(created_at) as last_error_date
          FROM nutringroup.gummy_dev.historylog h
          WHERE (
            LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
            OR h.step IN (9, 10, 63, 64, 99)
          )`;
      
      const replacements = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      };

      // Adicionar filtros de data se fornecidos
      if (date_from) {
        query += ` AND h.created_at >= :date_from`;
        replacements.date_from = new Date(date_from);
      }
      if (date_to) {
        query += ` AND h.created_at <= :date_to`;
        replacements.date_to = new Date(date_to);
      }
      if (shopify_id) {
        query += ` AND h.shopify_id = :shopify_id`;
        replacements.shopify_id = shopify_id;
      }

      query += `
          GROUP BY shopify_id
        ),
        success_after_error AS (
          SELECT DISTINCT e.shopify_id
          FROM error_orders e
          JOIN nutringroup.gummy_dev.historylog h ON e.shopify_id = h.shopify_id
          WHERE h.step = 17 AND h.created_at > e.last_error_date
        ),
        orders_with_unresolved_errors AS (
          SELECT e.shopify_id
          FROM error_orders e
          LEFT JOIN success_after_error s ON e.shopify_id = s.shopify_id
          WHERE s.shopify_id IS NULL
        )
        SELECT h.*
        FROM nutringroup.gummy_dev.historylog h
        JOIN orders_with_unresolved_errors o ON h.shopify_id = o.shopify_id
        ORDER BY h.created_at DESC
        LIMIT :limit
        OFFSET :offset
      `;

      const logs = await HistoryLog.sequelize.query(query, {
        replacements,
        model: HistoryLog,
        mapToModel: true,
      });

      // Query para contar o total
      let countQuery = `
        WITH error_orders AS (
          SELECT DISTINCT shopify_id,
                 MAX(created_at) as last_error_date
          FROM nutringroup.gummy_dev.historylog h
          WHERE (
            LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
            OR h.step IN (9, 10, 63, 64, 99)
          )`;
      
      const countReplacements = {};
      if (date_from) {
        countQuery += ` AND h.created_at >= :date_from`;
        countReplacements.date_from = new Date(date_from);
      }
      if (date_to) {
        countQuery += ` AND h.created_at <= :date_to`;
        countReplacements.date_to = new Date(date_to);
      }
      if (shopify_id) {
        countQuery += ` AND h.shopify_id = :shopify_id`;
        countReplacements.shopify_id = shopify_id;
      }

      countQuery += `
          GROUP BY shopify_id
        ),
        success_after_error AS (
          SELECT DISTINCT e.shopify_id
          FROM error_orders e
          JOIN nutringroup.gummy_dev.historylog h ON e.shopify_id = h.shopify_id
          WHERE h.step = 17 AND h.created_at > e.last_error_date
        ),
        orders_with_unresolved_errors AS (
          SELECT e.shopify_id
          FROM error_orders e
          LEFT JOIN success_after_error s ON e.shopify_id = s.shopify_id
          WHERE s.shopify_id IS NULL
        )
        SELECT COUNT(*)
        FROM nutringroup.gummy_dev.historylog h
        JOIN orders_with_unresolved_errors o ON h.shopify_id = o.shopify_id
      `;

      const totalCount = await HistoryLog.sequelize.query(countQuery, {
        replacements: countReplacements,
        type: 'SELECT',
      });

      const total = totalCount[0].count;

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Erro ao listar logs com erro', {
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

  async getGroupedLogsWithErrors(req, res) {
    try {
      const { page = 1, limit = 20, shopify_id, date_from, date_to } = req.query;

      // Query para encontrar pedidos que têm erros mas NÃO foram integrados com sucesso após o último erro
      let query = `
        WITH error_orders AS (
          SELECT DISTINCT shopify_id,
                 MAX(created_at) as last_error_date
          FROM nutringroup.gummy_dev.historylog h
          WHERE (
            LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
            OR h.step IN (9, 10, 63, 64, 99)
          )`;
      
      const replacements = {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      };

      // Adicionar filtros de data se fornecidos
      if (date_from) {
        query += ` AND h.created_at >= :date_from`;
        replacements.date_from = new Date(date_from);
      }
      if (date_to) {
        query += ` AND h.created_at <= :date_to`;
        replacements.date_to = new Date(date_to);
      }
      if (shopify_id) {
        query += ` AND h.shopify_id = :shopify_id`;
        replacements.shopify_id = shopify_id;
      }

      query += `
          GROUP BY shopify_id
        ),
        success_after_error AS (
          SELECT DISTINCT e.shopify_id
          FROM error_orders e
          JOIN nutringroup.gummy_dev.historylog h ON e.shopify_id = h.shopify_id
          WHERE h.step = 17 AND h.created_at > e.last_error_date
        )
        SELECT e.shopify_id
        FROM error_orders e
        LEFT JOIN success_after_error s ON e.shopify_id = s.shopify_id
        WHERE s.shopify_id IS NULL
        ORDER BY e.shopify_id DESC
        LIMIT :limit
        OFFSET :offset
      `;

      const uniqueShopifyIds = await HistoryLog.sequelize.query(query, {
        replacements,
        type: 'SELECT',
      });

      const shopifyIds = uniqueShopifyIds.map(log => log.shopify_id);

      const groupedLogs = [];
      for (const id of shopifyIds) {
        const logs = await HistoryLog.findAll({
          where: { shopify_id: id },
          order: [['step', 'ASC'], ['created_at', 'ASC']],
        });

        groupedLogs.push({
          shopify_id: id,
          logs,
        });
      }

      // Query para contar o total
      let countQuery = `
        WITH error_orders AS (
          SELECT DISTINCT shopify_id,
                 MAX(created_at) as last_error_date
          FROM nutringroup.gummy_dev.historylog h
          WHERE (
            LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
            OR h.step IN (9, 10, 63, 64, 99)
          )`;
      
      const countReplacements = {};
      if (date_from) {
        countQuery += ` AND h.created_at >= :date_from`;
        countReplacements.date_from = new Date(date_from);
      }
      if (date_to) {
        countQuery += ` AND h.created_at <= :date_to`;
        countReplacements.date_to = new Date(date_to);
      }
      if (shopify_id) {
        countQuery += ` AND h.shopify_id = :shopify_id`;
        countReplacements.shopify_id = shopify_id;
      }

      countQuery += `
          GROUP BY shopify_id
        ),
        success_after_error AS (
          SELECT DISTINCT e.shopify_id
          FROM error_orders e
          JOIN nutringroup.gummy_dev.historylog h ON e.shopify_id = h.shopify_id
          WHERE h.step = 17 AND h.created_at > e.last_error_date
        )
        SELECT COUNT(*)
        FROM error_orders e
        LEFT JOIN success_after_error s ON e.shopify_id = s.shopify_id
        WHERE s.shopify_id IS NULL
      `;

      const totalCount = await HistoryLog.sequelize.query(countQuery, {
        replacements: countReplacements,
        type: 'SELECT',
      });

      const total = totalCount[0].count;

      res.status(200).json({
        success: true,
        data: groupedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(total),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Erro ao buscar logs agrupados com erro', {
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
   * Busca estatísticas dos logs
   * @param {object} req 
   * @param {object} res 
   */
  async getLogStats(req, res) {
    try {
      const { date_from, date_to } = req.query;

      const where = {};
      if (date_from || date_to) {
        where.created_at = {};
        if (date_from) {
          where.created_at[Op.gte] = new Date(date_from);
        }
        if (date_to) {
          where.created_at[Op.lte] = new Date(date_to);
        }
      }

      // Estatísticas por step
      const stepStats = await HistoryLog.findAll({
        attributes: [
          'step',
          [HistoryLog.sequelize.fn('COUNT', HistoryLog.sequelize.col('step')), 'count'],
        ],
        where,
        group: ['step'],
        order: [['step', 'ASC']],
      });

      // Total de logs
      const totalLogs = await HistoryLog.count({ where });

      // Total de pedidos únicos
      const totalOrders = await HistoryLog.count({
        distinct: true,
        col: 'shopify_id',
        where,
      });

      // Logs de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayLogs = await HistoryLog.count({
        where: {
          ...where,
          created_at: { [Op.gte]: today },
        },
      });

      // Logs com erro (steps 9, 10, 63, 64, 99)
      const errorLogs = await HistoryLog.count({
        where: {
          ...where,
          step: { [Op.in]: [9, 10, 63, 64, 99] },
        },
      });

      // Pedidos integrados com sucesso (step 17)
      const successfulIntegrations = await HistoryLog.count({
        where: {
          ...where,
          step: 17,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          total_logs: totalLogs,
          total_orders: totalOrders,
          today_logs: todayLogs,
          error_logs: errorLogs,
          successful_integrations: successfulIntegrations,
          step_stats: stepStats,
        },
      });

    } catch (error) {
      logger.error('Erro ao buscar estatísticas dos logs', {
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
   * Cria um novo log de histórico
   * @param {object} req 
   * @param {object} res 
   */
  async createLog(req, res) {
    try {
      const { step, shopify_id, log } = req.body;

      if (!step || !shopify_id) {
        return res.status(400).json({
          success: false,
          message: 'step e shopify_id são obrigatórios',
        });
      }

      const newLog = await HistoryLog.create({
        step,
        shopify_id,
        log: log || {},
      });

      logger.info('Novo log de histórico criado', {
        id: newLog.id,
        step,
        shopify_id,
      });

      res.status(201).json({
        success: true,
        message: 'Log criado com sucesso',
        data: newLog,
      });

    } catch (error) {
      logger.error('Erro ao criar log de histórico', {
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
   * Remove logs antigos
   * @param {object} req 
   * @param {object} res 
   */
  async cleanOldLogs(req, res) {
    try {
      const { days = 30 } = req.query;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      const deletedCount = await HistoryLog.destroy({
        where: {
          created_at: { [Op.lt]: cutoffDate },
        },
      });

      logger.info('Logs antigos removidos', {
        deletedCount,
        cutoffDate,
      });

      res.status(200).json({
        success: true,
        message: `${deletedCount} logs antigos removidos`,
        deleted_count: deletedCount,
      });

    } catch (error) {
      logger.error('Erro ao limpar logs antigos', {
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
}

module.exports = HistoryLogController;