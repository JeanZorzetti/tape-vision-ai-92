/**
 * Logging Services - Application logging and audit trails
 */

export { LoggingService, loggingService } from './LoggingService';

export const loggingServices = {
  LoggingService
} as const;

export const loggingServiceInstances = {
  loggingService: LoggingService.getInstance()
} as const;