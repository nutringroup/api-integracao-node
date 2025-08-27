const { Model, DataTypes } = require('sequelize');
const SequelizeConnect = require("../../../../config/sequelize_request");
const sequelize = SequelizeConnect.getInstance().getSequelize();

class Abbreviation extends Model {}

Abbreviation.init(
  {
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    abbreviation: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    word: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW 
    },
    updated_at: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      defaultValue: DataTypes.NOW 
    },
  },
  {
    sequelize,
    modelName: 'Abbreviation',
    tableName: 'abbreviation',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Abbreviation;
