const { Model, DataTypes } = require("sequelize");
const SequelizeConnect = require("../../../../config/sequelize_request");

const sequelize = SequelizeConnect.getInstance().getSequelize();

class HistoryLog extends Model {}

HistoryLog.init(
  {
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
  },
  {
    sequelize,
    modelName: "HistoryLog",
    tableName: "historylog",
    freezeTableName: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = HistoryLog;
