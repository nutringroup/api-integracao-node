const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
require('dotenv').config();

// Configuração de cores para diferentes níveis
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  verbose: 'cyan',
};

winston.addColors(colors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Formato para console
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Configuração de transports
const transports = [];

// Console transport (sempre ativo)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
  })
);

// File transports (apenas em produção ou quando especificado)
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Log de aplicação geral
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: process.env.LOG_LEVEL || 'info',
    })
  );

  // Log de erros separado
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'error',
    })
  );

  // Log de OMIE específico
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'omie-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'debug',
    })
  );

  // Log de filas específico
  transports.push(
    new DailyRotateFile({
      filename: path.join('logs', 'queue-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'debug',
    })
  );
}

// Criar logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// Logger específico para OMIE
const omieLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    }),
    ...(process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true' ? [
      new DailyRotateFile({
        filename: path.join('logs', 'omie-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: logFormat,
        level: 'debug',
      })
    ] : []),
  ],
  exitOnError: false,
});

// Logger específico para filas
const queueLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    }),
    ...(process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true' ? [
      new DailyRotateFile({
        filename: path.join('logs', 'queue-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: logFormat,
        level: 'debug',
      })
    ] : []),
  ],
  exitOnError: false,
});

// Função para criar logger específico para um serviço
const createServiceLogger = (serviceName) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.label({ label: serviceName }),
      logFormat
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.label({ label: serviceName }),
          consoleFormat
        ),
      }),
      ...(process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true' ? [
        new DailyRotateFile({
          filename: path.join('logs', `${serviceName}-%DATE%.log`),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: process.env.LOG_MAX_SIZE || '20m',
          maxFiles: process.env.LOG_MAX_FILES || '14d',
          format: winston.format.combine(
            winston.format.label({ label: serviceName }),
            logFormat
          ),
        })
      ] : []),
    ],
    exitOnError: false,
  });
};

// Middleware para Express
const expressMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });

  next();
};

module.exports = {
  logger,
  omieLogger,
  queueLogger,
  createServiceLogger,
  expressMiddleware,
}; 