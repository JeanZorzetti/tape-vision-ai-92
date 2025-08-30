/**
 * ML Services - Machine Learning and AI services
 */

export { MLService, mlService } from './MLService';
export { default as MLEngineService } from './MLEngineService';
export { default as MLPredictionService } from './MLPredictionService';

export const mlServices = {
  MLService,
  MLEngineService,
  MLPredictionService
} as const;

export const mlServiceInstances = {
  mlService: MLService.getInstance()
} as const;