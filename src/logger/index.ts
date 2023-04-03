import { createLogger, format, transports } from 'winston';
import { env } from '..';

const { combine, timestamp, printf, label, prettyPrint } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const baseFormats = [timestamp(), prettyPrint()];

const loggerLevel = env.LOG_LEVEL;
export const logger = createLogger({
  level: loggerLevel,
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

if (process.env.NODE_ENV === 'production') {
  if (!env.DD_API_KEY) {
    logger.info('DD_API_KEY is not set, skipping datadog logger setup');
  } else {
    logger.info('Setting up datadog logger');
    const apiFormat = combine(label({ label: 'api' }), ...baseFormats);
    const relayerFormat = combine(label({ label: 'relayer' }), ...baseFormats);
    const datadogService =
      env.CHAIN_ENV === 'devnet'
        ? 'evm-cosmos-relayer-devnet'
        : 'evm-cosmos-relayer-testnet';
    const httpTransportOptions = {
      host: 'http-intake.logs.datadoghq.com',
      path: `/api/v2/logs?dd-api-key=${env.DD_API_KEY}&ddsource=nodejs&service=${datadogService}`,
      ssl: true,
    };
    logger.info(JSON.stringify(httpTransportOptions));
    logger.add(
      new transports.Http({
        ...httpTransportOptions,
        format: relayerFormat,
      })
    );
    apiLogger.add(
      new transports.Http({
        ...httpTransportOptions,
        format: apiFormat,
      })
    );
  }
} else {
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
}
