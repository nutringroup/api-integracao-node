const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const CreateTokenEnum = require('../../../auth/shared/enum/create_token_enum');
const { default: authTokenServices } = require('../../../auth/shared/services/auth_token_services.');
const SequelizeConnect = require('../../../../config/sequelize_request');


const User = SequelizeConnect.define('user', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  }
}, {
  tableName: 'user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true
});


User.prototype.passwordVerify = function(password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.setToken = function(profile) {
  const token = authTokenServices.createTokenJWT(this.id, CreateTokenEnum.tokenLogin, profile);
  this.token = token;
};

module.exports = User;
