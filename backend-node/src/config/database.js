const { Sequelize } = require('sequelize');
const { logger } = require('./logger');

// Definir schema baseado no ambiente
const getSchema = () => {
  const env = process.env.NODE_ENV || 'development';
  switch (env) {
    case 'production':
      return 'public';
    case 'development':
      return 'gummy_dev';
    case 'test':
      return 'gummy_test';
    default:
      return 'gummy_dev';
  }
};

const SCHEMA = getSchema();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'nutringroup',
  username: process.env.DB_USERNAME || 'gummy',
  password: process.env.DB_PASSWORD || 'password',
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false,
    timezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo'
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? 
    (msg) => logger.debug(msg) : false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    schema: SCHEMA
  },
  timezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo'
};

const sequelize = new Sequelize(config);

// Função para criar schema se não existir
const createSchemaIfNotExists = async () => {
  try {
    if (SCHEMA !== 'public') {
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
      logger.info(`✅ Schema "${SCHEMA}" criado/verificado com sucesso`);
    }
  } catch (error) {
    logger.error(`❌ Erro ao criar schema "${SCHEMA}":`, error.message);
    throw error;
  }
};

// Teste de conexão
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexão com PostgreSQL estabelecida com sucesso');
    
    // Criar schema se necessário
    await createSchemaIfNotExists();
    
    // Definir search_path para o schema correto
    if (SCHEMA !== 'public') {
      await sequelize.query(`SET search_path TO "${SCHEMA}", public`);
      logger.info(`✅ Search path definido para schema "${SCHEMA}"`);
    }
  } catch (error) {
    logger.error('❌ Erro ao conectar com PostgreSQL:', error.message);
    process.exit(1);
  }
};

// Função para fechar conexão graciosamente
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('🔌 Conexão com banco de dados fechada.');
  } catch (error) {
    console.error('❌ Erro ao fechar conexão com banco de dados:', error.message);
  }
};

// Gerenciamento de eventos de processo
process.on('SIGINT', async () => {
  console.log('\n🛑 Recebido SIGINT. Fechando conexão com banco de dados...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Recebido SIGTERM. Fechando conexão com banco de dados...');
  await closeConnection();
  process.exit(0);
});

module.exports = {
  sequelize,
  testConnection,
  closeConnection,
  SCHEMA,
}; 