/**
 * Toast Helper - Wraps react-toastify with notification manager checks
 */
import { toast, TypeOptions } from 'react-toastify';
import { notificationManager } from './notificationManager';

interface ToastOptions {
  autoClose?: number;
  hideProgressBar?: boolean;
  closeOnClick?: boolean;
  pauseOnHover?: boolean;
  draggable?: boolean;
  type?: TypeOptions;
}

/**
 * Show toast only if notification manager allows it
 */
export const showToast = (
  message: string,
  type: TypeOptions = 'info',
  options: ToastOptions = {},
  notificationKey?: string,
  notificationType?: 'signal' | 'trade' | 'position' | 'news',
  data?: any
): void => {
  // Always show errors
  if (type === 'error') {
    toast(message, {
      type,
      position: 'bottom-right',
      autoClose: options.autoClose || 5000,
      hideProgressBar: options.hideProgressBar ?? false,
      closeOnClick: options.closeOnClick ?? true,
      pauseOnHover: options.pauseOnHover ?? true,
      draggable: options.draggable ?? true,
      ...options,
    });
    return;
  }

  // Check notification manager for other types
  if (notificationType && notificationKey) {
    if (!notificationManager.shouldNotify(notificationType, notificationKey, data)) {
      return; // Blocked by notification manager
    }
  }

  // Show toast
  toast(message, {
    type,
    position: 'bottom-right',
    autoClose: options.autoClose || 3000,
    hideProgressBar: options.hideProgressBar ?? false,
    closeOnClick: options.closeOnClick ?? true,
    pauseOnHover: options.pauseOnHover ?? true,
    draggable: options.draggable ?? true,
    ...options,
  });
};

/**
 * Convenience functions
 */
export const toastSuccess = (message: string, key?: string, data?: any) => {
  showToast(message, 'success', {}, key, 'trade', data);
};

export const toastError = (message: string) => {
  showToast(message, 'error'); // Errors always show
};

export const toastInfo = (message: string, key?: string, data?: any) => {
  showToast(message, 'info', {}, key, 'position', data);
};

export const toastWarning = (message: string) => {
  showToast(message, 'warning'); // Warnings always show
};
