const winston = require('winston');
const readline = require('readline');
const pmx = require('pmx')
const path = require('path');
const requestContext = require('./requestContext');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}
const timezoned = () => {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
    });
}
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: timezoned }),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            const pid = process.pid;
            const context = requestContext.get();
            const requestId = context.requestId;
            return JSON.stringify({
                timestamp,
                level,
                pid,
                requestId: requestId,
                message,
                ...metadata
            });
        })
    ),
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
           format: winston.format.combine(
                winston.format.timestamp({ format: timezoned }),
                winston.format.prettyPrint()
            ),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

logger.info(`Logger initialized with level: ${logger.level} --- ${new Date().toISOString()}`);

/** NOTE: To be used in local **/
// Create a CLI interface for real-time log level changes
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (validLevels.includes(input.trim())) {
        logger.level = input.trim();
        logger.log(`Log level changed to: ${input.trim()}`);
    } else {
        logger.log('Invalid log level. Use one of:', validLevels.join(', '));
    }
});

/** NOTE: To be used in production **/
// Listen for PM2 trigger to update log level at runtime
pmx.action('set-log-level', (level, reply) => {
    if (['error', 'warn', 'info', 'debug'].includes(level)) {
        logger.level = level;
        logger.info(`Log level changed to: ${level}`);
        reply({ success: true, newLevel: level });
    } else {
        reply({ success: false, message: 'Invalid log level' });
    }
});

// Add console transport for all environments
logger.add(new winston.transports.Console({
    format: process.env.NODE_ENV !== 'production'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                const pid = process.pid;
                return `${timestamp} [${pid}] ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`;
            })
        )
        : winston.format.combine(
            winston.format.timestamp({ format: timezoned }),
            winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                const pid = process.pid;
                return `${timestamp} [${pid}] ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`;
            })
        )
}));

module.exports = logger;
