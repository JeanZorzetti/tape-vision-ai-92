import { Position, IPosition, Order, MarketData } from '../models';
import { marketDataService } from './MarketDataService';

export class PositionService {
  private static instance: PositionService;

  public static getInstance(): PositionService {
    if (!PositionService.instance) {
      PositionService.instance = new PositionService();
    }
    return PositionService.instance;
  }

  public async updatePositionPnL(positionId: string): Promise<{ success: boolean; position?: IPosition }> {
    try {
      const position = await Position.findById(positionId);
      if (!position) {
        return { success: false };
      }

      // Get current market price
      const marketData = await marketDataService.getLatestData(position.symbol);
      const currentPrice = marketData?.price || position.averagePrice;

      // Update P&L
      position.updatePnL(currentPrice);
      position.updateRiskMetrics();

      // Check stop loss and take profit
      if (position.shouldTriggerStopLoss(currentPrice)) {
        await this.triggerStopLoss(position);
      } else if (position.shouldTriggerTakeProfit(currentPrice)) {
        await this.triggerTakeProfit(position);
      }

      await position.save();

      return { success: true, position };
    } catch (error) {
      console.error('Update position P&L error:', error);
      return { success: false };
    }
  }

  public async getAllOpenPositions(userId?: string): Promise<IPosition[]> {
    try {
      const filter: any = { status: { $in: ['OPEN', 'PARTIALLY_CLOSED'] } };
      if (userId) filter.userId = userId;

      return await Position.find(filter).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Get all open positions error:', error);
      return [];
    }
  }

  private async triggerStopLoss(position: IPosition): Promise<void> {
    if (position.stopLoss) {
      position.stopLoss.isTriggered = true;
      position.stopLoss.triggerTime = new Date();
      
      position.closePosition(position.stopLoss.price);
      position.addEvent('STOP_LOSS', 'Stop loss triggered');
      
      await position.save();
    }
  }

  private async triggerTakeProfit(position: IPosition): Promise<void> {
    if (position.takeProfit) {
      position.takeProfit.isTriggered = true;
      position.takeProfit.triggerTime = new Date();
      
      position.closePosition(position.takeProfit.price);
      position.addEvent('TAKE_PROFIT', 'Take profit triggered');
      
      await position.save();
    }
  }
}

export const positionService = PositionService.getInstance();
export default positionService;