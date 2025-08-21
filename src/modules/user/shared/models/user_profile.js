const { Model, DataTypes } = require('sequelize');
const SequelizeConnect = require("../../../../config/sequelize_request");
const sequelize = SequelizeConnect.getInstance().getSequelize();

class UserProfile extends Model {}

UserProfile.init(
  {
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    id_profile: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { 
        model: 'profile', 
        key: 'id' 
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    id_user: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { 
        model: 'user', 
        key: 'id' 
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'UserProfile',
    tableName: 'user_profile',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = UserProfile;
