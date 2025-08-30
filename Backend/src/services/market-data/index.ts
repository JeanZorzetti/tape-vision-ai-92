/**
 * Market Data Services - Real-time market data processing
 */

export { MarketDataService, marketDataService } from './MarketDataService';
export { default as DataIntegrationService } from './DataIntegrationService';

export const marketDataServices = {
  MarketDataService,
  DataIntegrationService
} as const;

export const marketDataServiceInstances = {
  marketDataService: MarketDataService.getInstance()
} as const;