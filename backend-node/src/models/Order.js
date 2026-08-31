const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('orders', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  omie_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  shopify_id: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true, // Evitar duplicatas por shopify_id
  },
  omie_client: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  recebido: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  pago: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  nf: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  rastreio: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  saiu: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  entregue: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
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
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // indexes: [
  //   {
  //     unique: true,
  //     fields: ['shopify_id']
  //   }
  // ]
});

module.exports = Order; 