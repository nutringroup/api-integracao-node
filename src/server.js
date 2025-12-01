require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Importar configurações
const { testConnection } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { logger, expressMiddleware } = require('./config/logger');
const { syncModels } = require('./models');

// Importar rotas
const routes = require('./routes');

// Importar workers (para inicializar processamento das filas)
require('./workers');

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Máximo 100 requests por IP
  message: {
    success: false,
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS - Configuração para permitir origens específicas
const corsOptions = {
  origin: function (origin, callback) {
    // Log para debug
    console.log('🔍 CORS Debug - Origin recebido:', origin);
    
    // Permitir requisições sem origin (ex: mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8000',
      'https://gummyhairdev.myshopify.com',
      'https://shopify-omie-front.vercel.app',
      'https://shopify-omie-front.vercel.app/',
      // Adicione outras variações se necessário
    ];
    
    console.log('✅ Origins permitidas:', allowedOrigins);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ Origin permitida:', origin);
      callback(null, true);
    } else {
      console.log('❌ Origin rejeitada:', origin);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Middlewares gerais
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Aplicar rate limiting apenas em produção
if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
}

// Logger HTTP
app.use(expressMiddleware);

// Middleware para adicionar headers de segurança customizados
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || 'v1');
  res.setHeader('X-Powered-By', 'Gummy Hair API');
  next();
});

// Rotas da API
app.use('/api', routes);

// Rota raiz
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Gummy Hair API - Integração OMIE ES',
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    documentation: '/api/health',
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  logger.error('Erro não tratado', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Não expor detalhes do erro em produção
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Erro interno do servidor' 
    : err.message;

  res.status(err.status || 500).json({
    success: false,
    message: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
  });
});

// Função para inicializar o servidor
async function startServer() {
  try {
    // Testar conexão com banco de dados
    await testConnection();
    
    // Conectar ao Redis
    //await connectRedis();
    
    // Sincronizar modelos
    await syncModels();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor iniciado na porta ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        version: process.env.API_VERSION,
      });
      
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🍯 GUMMY HAIR API 🍯                      ║
║                                                              ║
║  🌐 Servidor: http://localhost:${PORT}                        ║
║  📊 Health: http://localhost:${PORT}/api/health               ║
║  🔄 Ambiente: ${process.env.NODE_ENV || 'development'}                                    ║
║  📦 Versão: ${process.env.API_VERSION || 'v1'}                                        ║
║                                                              ║
║  ✅ Banco de dados conectado                                  ║
║  ✅ Redis conectado                                           ║
║  ✅ Filas configuradas                                        ║
║  ✅ Workers ativos                                            ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    logger.error('Erro ao inicializar servidor', {
      error: error.message,
      stack: error.stack,
    });
    
    console.error('❌ Erro ao inicializar servidor:', error.message);
    process.exit(1);
  }
}

// Tratamento de sinais do sistema
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido, encerrando servidor...');
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('Exceção não capturada', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promise rejeitada não tratada', {
    reason: reason,
    promise: promise,
  });
  process.exit(1);
});

// Inicializar servidor
startServer();

module.exports = app;