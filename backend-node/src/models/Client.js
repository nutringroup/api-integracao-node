const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Client = sequelize.define('clients', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  omie_client: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  shopify_client: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  cpf: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true, // Evitar duplicatas por CPF
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
  tableName: 'clients',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // indexes: [
  //   {
  //     unique: true,
  //     fields: ['cpf']
  //   }
  // ]
});

module.exports = Client; 