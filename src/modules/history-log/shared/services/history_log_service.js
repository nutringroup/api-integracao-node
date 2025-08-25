const { default: HelperErrorException } = require('../../../../shared/exceptions/exception_error');
const historyLogHelper = require('../helpers/history_log_helper');
import { Op } from 'sequelize';
import HistoryLogError from '../../../../shared/exceptions/history-log/history_log_exception';
import  HistoryLog  from '../models/history_log';


class HistoryLogService {

  async listLogs(query) {
    try {
      return await historyLogHelper.listLogsHelper(query);
    } catch (error) {
      throw error;
    }
  }

  async getOrderLogs(shopify_id) {
    try {
    const logs = await historyLogHelper.getOrderLogsHelper(shopify_id);
    if (!logs || logs.length === 0) {throw new HistoryLogError(HelperErrorException.logNotFound);}
    return logs;
    } catch (error) {
      throw error;
    }
  }

  async getGroupedLogs(query) {
    try {
      return await historyLogHelper.getGroupedLogsHelper(query);
    } catch (error) {
      throw error;
    }
  }

  async listLogsWithErrors(query) {
    try {
      return await historyLogHelper.listLogsWithErrorsHelper(query);
    } catch (error) {
      throw error;
    }
  }

  async getGroupedLogsWithErrors(query) {
    try {
      return await historyLogHelper.getGroupedLogsWithErrorsHelper(query);
    } catch (error) {
      throw error;
    }
  }

  async getLogStats(query) {
    try {
      return await historyLogHelper.getLogStatsHelper(query);
    } catch (error) {
      throw error;
    }
  }

  async createLog({ step, shopify_id, log }) {
      if (!step || !shopify_id) {
         throw new HistoryLogError(HelperErrorException.requiredFields);
      }

      const newLog = await HistoryLog.create({
        step,
        shopify_id,
        log: log || {},
      });

      return {
        success: true,
        message: 'Log criado com sucesso',
        data: newLog,
      };
    }

  async cleanOldLogs(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const deletedCount = await HistoryLog.destroy({
      where: { created_at: { [Op.lt]: cutoffDate } },
    });

    if (deletedCount === 0) {
      throw new HistoryLogError(HelperErrorException.oldLogsCleanFail);
    }

    return {
      success: true,
      message: `${deletedCount} logs antigos removidos`,
      deleted_count: deletedCount,
    };
  }

}

module.exports = new HistoryLogService();
