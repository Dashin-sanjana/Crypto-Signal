/**
 * Notification Manager - Handles notification throttling and preferences
 */

interface NotificationSettings {
  signalNotifications: boolean;
  tradeNotifications: boolean;
  positionNotifications: boolean;
  newsNotifications: boolean;
  onlyImportant: boolean; // Only show important notifications
  throttleMs: number; // Throttle interval in milliseconds
}

const DEFAULT_SETTINGS: NotificationSettings = {
  signalNotifications: false, // Disable signal toasts by default (too many)
  tradeNotifications: true,
  positionNotifications: true,
  newsNotifications: false,
  onlyImportant: true, // Only show important by default
  throttleMs: 10000, // 10 seconds throttle (increased from 5)
};

class NotificationManager {
  private settings: NotificationSettings;
  private lastNotificationTime: Map<string, number> = new Map();
  private notificationCount: Map<string, number> = new Map();

  constructor() {
    // Load settings from localStorage
    const saved = localStorage.getItem('notification_settings');
    this.settings = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  }

  /**
   * Check if notification should be shown based on throttling
   */
  shouldShowNotification(key: string): boolean {
    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(key) || 0;
    const timeSinceLastNotification = now - lastTime;

    if (timeSinceLastNotification < this.settings.throttleMs) {
      // Throttled - don't show
      const count = (this.notificationCount.get(key) || 0) + 1;
      this.notificationCount.set(key, count);
      return false;
    }

    // Reset counter and update time
    this.lastNotificationTime.set(key, now);
    this.notificationCount.set(key, 0);
    return true;
  }

  /**
   * Check if notification type is enabled
   */
  isEnabled(type: keyof NotificationSettings): boolean {
    return this.settings[type] || false;
  }

  /**
   * Update settings
   */
  updateSettings(updates: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...updates };
    localStorage.setItem('notification_settings', JSON.stringify(this.settings));
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Reset throttling for a key
   */
  resetThrottle(key: string): void {
    this.lastNotificationTime.delete(key);
    this.notificationCount.delete(key);
  }

  /**
   * Check if notification is "important" (should always show)
   */
  isImportant(type: 'signal' | 'trade' | 'position' | 'news', data?: any): boolean {
    if (!this.settings.onlyImportant) {
      return true; // Show all if not filtering
    }

    switch (type) {
      case 'signal':
        // Only show signals with high strength
        return data?.strength >= 8;
      case 'trade':
        // Only show trades if they're significant or manual
        // Auto-trades are throttled more aggressively
        return data?.isManual === true || data?.isImportant === true;
      case 'position':
        // Only show position closures with significant P&L
        return Math.abs(data?.pnl || 0) > 10; // $10 threshold
      case 'news':
        // Only show bullish/bearish news
        return data?.sentiment === 'bullish' || data?.sentiment === 'bearish';
      default:
        return false;
    }
  }

  /**
   * Should show notification (combines all checks)
   */
  shouldNotify(type: 'signal' | 'trade' | 'position' | 'news', key: string, data?: any): boolean {
    // Check if type is enabled
    const typeKey = `${type}Notifications` as keyof NotificationSettings;
    if (!this.isEnabled(typeKey)) {
      return false;
    }

    // Check if important (if filtering enabled)
    if (!this.isImportant(type, data)) {
      return false;
    }

    // Check throttling
    return this.shouldShowNotification(key);
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();
