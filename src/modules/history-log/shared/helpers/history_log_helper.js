const { HistoryLog } = require('../models');
const { Op } = require('sequelize');

class HistoryLogHelper {

  async listLogsHelper({ page, limit, shopify_id, step, date_from, date_to }) {
    const where = {};
    if (shopify_id) where.shopify_id = { [Op.like]: `%${shopify_id}%` };
    if (step) where.step = step;

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) where.created_at[Op.lte] = new Date(date_to);
    }

    return await HistoryLog.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['created_at', 'DESC']],
    });
  }

  async getOrderLogsHelper(shopify_id) {
    return await HistoryLog.findAll({
      where: { shopify_id },
      order: [['step', 'ASC'], ['created_at', 'ASC']],
    });
  }

  async getGroupedLogsHelper({ page, limit, shopify_id, date_from, date_to }) {
    const where = {};
    if (shopify_id) where.shopify_id = { [Op.like]: `%${shopify_id}%` };
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) where.created_at[Op.lte] = new Date(date_to);
    }

    const uniqueShopifyIds = await HistoryLog.findAll({
      attributes: ['shopify_id'],
      where,
      group: ['shopify_id'],
      order: [['shopify_id', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    const shopifyIds = uniqueShopifyIds.map(log => log.shopify_id);

    const groupedLogs = [];
    for (const id of shopifyIds) {
      const logs = await HistoryLog.findAll({
        where: { shopify_id: id },
        order: [['step', 'ASC'], ['created_at', 'ASC']],
      });
      groupedLogs.push({ shopify_id: id, logs });
    }

    const totalCount = await HistoryLog.count({
      distinct: true,
      col: 'shopify_id',
      where,
    });

    return { groupedLogs, totalCount };
  }

  async listLogsWithErrorsHelper({ page, limit, shopify_id, date_from, date_to }) {
    let query = `
      WITH error_orders AS (
        SELECT DISTINCT shopify_id, MAX(created_at) as last_error_date
        FROM nutringroup.gummy_dev.historylog h
        WHERE (
          LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
          OR h.step IN (9, 10, 63, 64, 99)
        )`;

    const replacements = { limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) };

    if (date_from) { query += ` AND h.created_at >= :date_from`; replacements.date_from = new Date(date_from); }
    if (date_to) { query += ` AND h.created_at <= :date_to`; replacements.date_to = new Date(date_to); }
    if (shopify_id) { query += ` AND h.shopify_id = :shopify_id`; replacements.shopify_id = shopify_id; }

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
      LIMIT :limit OFFSET :offset
    `;

    const logs = await HistoryLog.sequelize.query(query, {
      replacements,
      model: HistoryLog,
      mapToModel: true,
    });

    let countQuery = `
      WITH error_orders AS (
        SELECT DISTINCT shopify_id, MAX(created_at) as last_error_date
        FROM nutringroup.gummy_dev.historylog h
        WHERE (
          LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
          OR h.step IN (9, 10, 63, 64, 99)
        )`;

    const countReplacements = {};
    if (date_from) { countQuery += ` AND h.created_at >= :date_from`; countReplacements.date_from = new Date(date_from); }
    if (date_to) { countQuery += ` AND h.created_at <= :date_to`; countReplacements.date_to = new Date(date_to); }
    if (shopify_id) { countQuery += ` AND h.shopify_id = :shopify_id`; countReplacements.shopify_id = shopify_id; }

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

    return { logs, total: totalCount[0].count };
  }

  async getGroupedLogsWithErrorsHelper({ page, limit, shopify_id, date_from, date_to }) {
    let query = `
      WITH error_orders AS (
        SELECT DISTINCT shopify_id, MAX(created_at) as last_error_date
        FROM nutringroup.gummy_dev.historylog h
        WHERE (
          LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
          OR h.step IN (9, 10, 63, 64, 99)
        )`;

    const replacements = { limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) };

    if (date_from) { query += ` AND h.created_at >= :date_from`; replacements.date_from = new Date(date_from); }
    if (date_to) { query += ` AND h.created_at <= :date_to`; replacements.date_to = new Date(date_to); }
    if (shopify_id) { query += ` AND h.shopify_id = :shopify_id`; replacements.shopify_id = shopify_id; }

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
      LIMIT :limit OFFSET :offset
    `;

    const uniqueShopifyIds = await HistoryLog.sequelize.query(query, { replacements, type: 'SELECT' });
    const shopifyIds = uniqueShopifyIds.map(log => log.shopify_id);

    const groupedLogs = [];
    for (const id of shopifyIds) {
      const logs = await HistoryLog.findAll({
        where: { shopify_id: id },
        order: [['step', 'ASC'], ['created_at', 'ASC']],
      });
      groupedLogs.push({ shopify_id: id, logs });
    }

    let countQuery = `
      WITH error_orders AS (
        SELECT DISTINCT shopify_id, MAX(created_at) as last_error_date
        FROM nutringroup.gummy_dev.historylog h
        WHERE (
          LOWER(h.log::text) ~ 'erro|fail|invalid|denied|bad request|unauthorized|not found|cidade n[aã]o encontrada'
          OR h.step IN (9, 10, 63, 64, 99)
        )`;

    const countReplacements = {};
    if (date_from) { countQuery += ` AND h.created_at >= :date_from`; countReplacements.date_from = new Date(date_from); }
    if (date_to) { countQuery += ` AND h.created_at <= :date_to`; countReplacements.date_to = new Date(date_to); }
    if (shopify_id) { countQuery += ` AND h.shopify_id = :shopify_id`; countReplacements.shopify_id = shopify_id; }

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

    const totalCount = await HistoryLog.sequelize.query(countQuery, { replacements: countReplacements, type: 'SELECT' });

    return { groupedLogs, total: totalCount[0].count };
  }

  async getLogStatsHelper({ date_from, date_to }) {
    const where = {};
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) where.created_at[Op.lte] = new Date(date_to);
    }

    const stepStats = await HistoryLog.findAll({
      attributes: ['step', [HistoryLog.sequelize.fn('COUNT', HistoryLog.sequelize.col('step')), 'count']],
      where,
      group: ['step'],
      order: [['step', 'ASC']],
    });

    const totalLogs = await HistoryLog.count({ where });
    const totalOrders = await HistoryLog.count({ distinct: true, col: 'shopify_id', where });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = await HistoryLog.count({ where: { ...where, created_at: { [Op.gte]: today } } });

    const errorLogs = await HistoryLog.count({ where: { ...where, step: { [Op.in]: [9, 10, 63, 64, 99] } } });
    const successfulIntegrations = await HistoryLog.count({ where: { ...where, step: 17 } });

    return { stepStats, totalLogs, totalOrders, todayLogs, errorLogs, successfulIntegrations };
  }


}

module.exports = new HistoryLogHelper();
