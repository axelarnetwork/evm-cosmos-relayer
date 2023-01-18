import { createLogger, format, transports } from 'winston';
import { env } from '..';

const { combine, timestamp, printf, label, prettyPrint } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const baseFormats = [timestamp(), prettyPrint()];

export const logger = createLogger({
  level: 'info',
  format: combine(label({ label: 'relayer' }), ...baseFormats),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

export const apiLogger = createLogger({
  level: 'info',
  format: combine(label({ label: 'api' }), ...baseFormats),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

logger.info(`Production: ${process.env.NODE_ENV}`);

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(label({ label: 'relayer' }), ...baseFormats, myFormat),
    })
  );
  apiLogger.add(
    new transports.Console({
      format: combine(label({ label: 'api' }), ...baseFormats, myFormat),
    })
  );
} else {
  if (!env.DD_API_KEY) {
    logger.info('DD_API_KEY is not set, skipping datadog logger setup');
  } else {
    logger.info('Setting up datadog logger');
    const apiFormat = combine(label({ label: 'api' }), ...baseFormats);
    const relayerFormat = combine(label({ label: 'relayer' }), ...baseFormats);
    const httpTransportOptions = {
      host: 'http-intake.logs.datadoghq.com',
      path: `/api/v2/logs?dd-api-key=${env.DD_API_KEY}&ddsource=nodejs&service=evm-cosmos-relayer-devnet`,
      ssl: true,
    };

    logger.info(httpTransportOptions);

    logger.add(
      new transports.Http({
        ...httpTransportOptions,
        format: relayerFormat,
      })
    );

    logger.add(
      new transports.Http({
        ...httpTransportOptions,
        format: apiFormat,
      })
    );
  }
}
