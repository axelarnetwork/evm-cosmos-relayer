import { logger } from "./logger";
import { startAPIServer } from "./api";
import { startRelayer } from "./relayer";

logger.info('Starting relayer api server...');
startAPIServer();
startRelayer();
