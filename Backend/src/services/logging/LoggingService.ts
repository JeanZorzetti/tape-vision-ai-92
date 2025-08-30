import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRADE';
  message: string;
  context?: string;
  metadata?: any;
}

export class LoggingService {
  private static instance: LoggingService;
  private logDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 10;

  constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.ensureLogDirectory();
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public async logTrade(userId: string, action: string, data: any): Promise<void> {
    await this.log('TRADE', `User ${userId}: ${action}`, 'trading', data);
  }

  public async logRisk(userId: string, event: string, riskScore: number): Promise<void> {
    await this.log('WARN', `Risk event: ${event}`, 'risk', { userId, riskScore });
  }

  public async logError(error: Error, context?: string): Promise<void> {
    await this.log('ERROR', error.message, context, { 
      stack: error.stack,
      name: error.name 
    });
  }

  public async log(
    level: LogEntry['level'],
    message: string,
    context?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const entry: LogEntry = {
        timestamp: new Date(),
        level,
        message,
        context,
        metadata
      };

      const logLine = JSON.stringify(entry) + '\n';
      const filename = this.getLogFilename(level);
      const filepath = path.join(this.logDir, filename);

      await fs.promises.appendFile(filepath, logLine);
      
      // Rotate logs if needed
      await this.rotateLogs(filepath);

    } catch (error) {
      console.error('Logging failed:', error);
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilename(level: LogEntry['level']): string {
    const date = new Date().toISOString().split('T')[0];
    
    switch (level) {
      case 'TRADE':
        return `trades-${date}.log`;
      case 'ERROR':
        return `errors-${date}.log`;
      default:
        return `application-${date}.log`;
    }
  }

  private async rotateLogs(filepath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filepath);
      
      if (stats.size > this.maxFileSize) {
        const timestamp = Date.now();
        const rotatedPath = `${filepath}.${timestamp}`;
        
        await fs.promises.rename(filepath, rotatedPath);
        
        // Clean old log files
        await this.cleanOldLogs(path.dirname(filepath));
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  private async cleanOldLogs(logDir: string): Promise<void> {
    // Implementation for cleaning old log files
    // Keep only the last N files
  }
}

export const loggingService = LoggingService.getInstance();
export default loggingService;