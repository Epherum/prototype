// src/lib/logger.ts
import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Define format for console logs in development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports
const transports = [];

// Console transport
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat,
    })
  );
} else {
  // Production console logging (for serverless environments like Vercel)
  transports.push(
    new winston.transports.Console({
      level: 'info', // Changed from 'warn' to 'info' to capture more logs
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    })
  );
}

// File transports for production (only in non-serverless environments)
// Vercel and other serverless platforms don't support persistent file system writes
if (isProduction && !process.env.VERCEL) {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    }),
    // Combined log file
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  levels: logLevels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create specific loggers for different contexts
export const apiLogger = logger.child({ service: 'api' });
export const serviceLogger = logger.child({ service: 'service' });
export const authLogger = logger.child({ service: 'auth' });
export const dbLogger = logger.child({ service: 'database' });

export default logger;