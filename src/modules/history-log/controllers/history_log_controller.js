const HistoryLogError = require('../../../shared/exceptions/history-log/history_log_exception');
const { logger } = require('../config/logger');
const historyLogService = require('../services/historyLog.service');

class HistoryLogController {
  
  async listLogs(req, res) {
    try {
      const logs = await historyLogService.listLogs(req.query);
      res.status(200).json({
        success: true,
        data: logs.rows,
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 50,
          total: logs.count,
          pages: Math.ceil(logs.count / (parseInt(req.query.limit) || 50)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro ao listar logs', error: error.message });
    }
  }

  async getOrderLogs(req, res) {
    try {
      const logs = await historyLogService.getOrderLogs(req.params.shopify_id);
      res.status(200).json({
        success: true,
        data: logs,
        shopify_id: req.params.shopify_id
      });
    } catch (error) {
      if (error instanceof HistoryLogError) {
        return res.status(404).json({ success: false, error: error.message });
      }
      return res.status(400).json({ success: false, error: HelperErrorException.errorDefault });
    }
  }

  async getGroupedLogs(req, res) {
    try {
      const { groupedLogs, totalCount } = await historyLogService.getGroupedLogs(req.query);
      res.status(200).json({
        success: true,
        data: groupedLogs,
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 20,
          total: totalCount,
          pages: Math.ceil(totalCount / (parseInt(req.query.limit) || 20)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro ao buscar logs agrupados', error: error.message });
    }
  }

  async listLogsWithErrors(req, res) {
    try {
      const { logs, total } = await historyLogService.listLogsWithErrors(req.query);
      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 50,
          total: parseInt(total),
          pages: Math.ceil(total / (parseInt(req.query.limit) || 50)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro ao listar logs com erros', error: error.message });
    }
  }

  async getGroupedLogsWithErrors(req, res) {
    try {
      const { groupedLogs, total } = await historyLogService.getGroupedLogsWithErrors(req.query);
      res.status(200).json({
        success: true,
        data: groupedLogs,
        pagination: {
          page: parseInt(req.query.page) || 20,
          limit: parseInt(req.query.limit) || 20,
          total: parseInt(total),
          pages: Math.ceil(total / (parseInt(req.query.limit) || 20)),
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro ao buscar logs agrupados com erros', error: error.message });
    }
  }

  async getLogStats(req, res) {
    try {
      const data = await historyLogService.getLogStats(req.query);
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erro ao buscar estatísticas de logs', error: error.message });
    }
  }

  async createLog(req, res) {
    try {
      const data = await historyLogService.createLog(req.body);
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof HistoryLogError) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: HelperErrorException.errorDefault });
    }
  }

  async cleanOldLogs(req, res) {
    try {
      const { days } = req.query;
      const data = await historyLogService.cleanOldLogs(days);
      res.status(200).json(data);
    } catch (error) {
      if (error instanceof HistoryLogError) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: HelperErrorException.errorDefault });
    }
  }
}

module.exports = new HistoryLogController();
