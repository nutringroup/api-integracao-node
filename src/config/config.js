require('dotenv').config();

const base = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: "postgres", 
  logging: false,
};

module.exports = {
  development: { ...base },
  test:        { ...base, database: `${process.env.DB_DATABASE}_test` },
  production:  { ...base }
};
