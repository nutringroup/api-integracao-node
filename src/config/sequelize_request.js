const { Sequelize } = require("sequelize");
require("dotenv").config(); 

class SequelizeConnect {
  static instance;
  sequelize;

  constructor() {
    if (SequelizeConnect.instance) {
      return SequelizeConnect.instance;
    }

    const database = process.env.DB_DATABASE;
    const username = process.env.DB_USERNAME;
    const password = process.env.DB_PASSWORD;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || 5432;

    this.sequelize = new Sequelize(database, username, password, {
      host,
      port,
      dialect: "postgres",
      logging: process.env.APP_DEBUG === "true",
      timezone: process.env.APP_TIMEZONE || "America/Sao_Paulo",
    });

    SequelizeConnect.instance = this;
  }

  static getInstance() {
    if (!SequelizeConnect.instance) {
      SequelizeConnect.instance = new SequelizeConnect();
    }
    return SequelizeConnect.instance;
  }

  getSequelize() {
    return this.sequelize;
  }
}

module.exports = SequelizeConnect;
