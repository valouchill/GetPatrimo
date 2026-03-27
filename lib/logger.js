const { createLogger, format, transports } = require('winston');
const crypto = require('crypto');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'patrimo-trust' },
  transports: [
    new transports.Console(),
  ],
});

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Express middleware: logs every incoming request with method, path, status, duration.
 */
function requestLoggerMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  const startTime = Date.now();

  // Attach requestId to request for downstream use
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'] || '',
    };

    // Extract userId from session if available
    if (req.user?.id) meta.userId = req.user.id;
    else if (req.user?.email) meta.userId = req.user.email;

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', meta);
    } else {
      logger.info('Request completed', meta);
    }
  });

  next();
}

module.exports = { logger, requestLoggerMiddleware, generateRequestId };
