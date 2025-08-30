/**
 * Core Services - Main business logic services
 */

export { UserService, userService } from './UserService';
export { TradingService, tradingService } from './TradingService';
export { RiskService, riskService } from './RiskService';

export const coreServices = {
  UserService,
  TradingService,
  RiskService
} as const;

export const coreServiceInstances = {
  userService: UserService.getInstance(),
  tradingService: TradingService.getInstance(),
  riskService: RiskService.getInstance()
} as const;