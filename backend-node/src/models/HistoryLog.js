const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HistoryLog = sequelize.define('historylog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  step: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  log: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  shopify_id: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'historylog',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = HistoryLog; 