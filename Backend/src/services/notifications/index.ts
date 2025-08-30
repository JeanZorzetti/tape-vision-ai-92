/**
 * Notification Services - Alerts and notification system
 */

export { NotificationService, notificationService } from './NotificationService';

export const notificationServices = {
  NotificationService
} as const;

export const notificationServiceInstances = {
  notificationService: NotificationService.getInstance()
} as const;