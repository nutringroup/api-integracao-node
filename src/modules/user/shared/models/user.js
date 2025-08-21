const { Model, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const CreateTokenEnum = require("../../../auth/shared/enum/create_token_enum");
const { default: authTokenServices } = require("../../../auth/shared/services/auth_token_service");
const SequelizeConnect = require("../../../../config/sequelize_request");

const sequelize = SequelizeConnect.getInstance().getSequelize();

class User extends Model {
  passwordVerify(password) {
    return bcrypt.compare(password, this.password);
  }

  setToken(profile) {
    const token = authTokenServices.createTokenJWT(
      this.id,
      CreateTokenEnum.tokenLogin,
      profile
    );
    this.token = token;
  }
}

User.init(
  {
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
      unique: true,
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
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "user",
    freezeTableName: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = User;
