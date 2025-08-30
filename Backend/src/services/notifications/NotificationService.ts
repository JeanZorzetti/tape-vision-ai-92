import { EventEmitter } from 'events';
import { User, RiskManagement } from '../models';

interface NotificationData {
  userId: string;
  type: 'RISK_ALERT' | 'TRADE_EXECUTED' | 'ML_SIGNAL' | 'SYSTEM_ALERT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  metadata?: any;
}

interface NotificationChannel {
  email?: boolean;
  push?: boolean;
  sms?: boolean;
  webhook?: boolean;
}

export class NotificationService extends EventEmitter {
  private static instance: NotificationService;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async sendNotification(data: NotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user preferences
      const user = await User.findById(data.userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const riskProfile = await RiskManagement.findOne({ userId: data.userId });
      const channels = riskProfile?.config.notificationSettings || {
        emailAlerts: true,
        pushNotifications: true,
        smsAlerts: false
      };

      // Check if notification should be sent based on severity
      if (!this.shouldSendNotification(data.severity, riskProfile?.config.notificationSettings.thresholds)) {
        return { success: true }; // Skip but don't error
      }

      // Send via enabled channels
      const promises = [];
      
      if (channels.emailAlerts) {
        promises.push(this.sendEmail(user.email, data));
      }
      
      if (channels.pushNotifications) {
        promises.push(this.sendPushNotification(data));
      }
      
      if (channels.smsAlerts) {
        promises.push(this.sendSMS(user.name, data));
      }

      await Promise.allSettled(promises);

      // Emit event for WebSocket broadcasting
      this.emit('notification', {
        userId: data.userId,
        ...data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: 'Failed to send notification' };
    }
  }

  public async sendRiskAlert(userId: string, riskScore: number, violations: string[]): Promise<void> {
    const severity = riskScore >= 90 ? 'CRITICAL' : riskScore >= 70 ? 'HIGH' : 'MEDIUM';
    
    await this.sendNotification({
      userId,
      type: 'RISK_ALERT',
      severity,
      title: `Risk Alert - Score: ${riskScore}`,
      message: `Risk violations detected: ${violations.join(', ')}`,
      metadata: { riskScore, violations }
    });
  }

  public async sendTradeNotification(userId: string, orderType: string, symbol: string, quantity: number): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'TRADE_EXECUTED',
      severity: 'MEDIUM',
      title: 'Trade Executed',
      message: `${orderType} ${quantity} ${symbol}`,
      metadata: { orderType, symbol, quantity }
    });
  }

  private shouldSendNotification(severity: string, thresholds?: any): boolean {
    if (!thresholds) return true;
    
    const severityScores = { LOW: 25, MEDIUM: 50, HIGH: 75, CRITICAL: 95 };
    const score = severityScores[severity as keyof typeof severityScores];
    
    return score >= (thresholds.warning || 50);
  }

  private async sendEmail(email: string, data: NotificationData): Promise<void> {
    // Email implementation placeholder
    console.log(`📧 Email sent to ${email}: ${data.title}`);
  }

  private async sendPushNotification(data: NotificationData): Promise<void> {
    // Push notification implementation placeholder
    console.log(`📱 Push notification: ${data.title}`);
  }

  private async sendSMS(phone: string, data: NotificationData): Promise<void> {
    // SMS implementation placeholder
    console.log(`📱 SMS sent to ${phone}: ${data.title}`);
  }
}

export const notificationService = NotificationService.getInstance();
export default notificationService;