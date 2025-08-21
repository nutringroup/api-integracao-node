const { Model, DataTypes } = require('sequelize');
const SequelizeConnect = require("../../../../config/sequelize_request");
const sequelize = SequelizeConnect.getInstance().getSequelize();

class Profile extends Model {}

Profile.init(
  {
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
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
    modelName: 'Profile',
    tableName: 'profile',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = Profile;
