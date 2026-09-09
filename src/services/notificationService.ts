import type { AppNotification, NotificationSettings, NotificationType } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'canal_notificacoes_v1';
const SETTINGS_STORAGE_KEY = 'canal_notificacoes_settings_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: false,
  emailAddress: '',
  notifyNewReferral: true,
  notifyStatusChange: true,
  notifyCommissionToPay: true
};

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Erro ao ler configurações de notificação', err);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Erro ao salvar configurações de notificação', err);
  }
}

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Erro ao ler notificações', err);
  }
  return [];
}

export function saveNotifications(list: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Erro ao salvar notificações', err);
  }
}

export interface DispatchNotificationParams {
  type: NotificationType;
  title: string;
  message: string;
  referralId?: string;
  partnerId?: string;
  partnerName?: string;
  dealValue?: number;
  commissionValue?: number;
}

export function dispatchNotification(params: DispatchNotificationParams): {
  notification: AppNotification;
  emailDispatched: boolean;
  emailRecipient?: string;
} {
  const settings = loadNotificationSettings();
  const currentList = loadNotifications();

  let shouldSendEmail = false;
  if (settings.emailEnabled && settings.emailAddress.trim() !== '') {
    if (params.type === 'nova_indicacao' && settings.notifyNewReferral) shouldSendEmail = true;
    if (params.type === 'mudanca_status' && settings.notifyStatusChange) shouldSendEmail = true;
    if (params.type === 'comissao_a_pagar' && settings.notifyCommissionToPay) shouldSendEmail = true;
    if (params.type === 'comissao_paga' && settings.notifyCommissionToPay) shouldSendEmail = true;
  }

  const notification: AppNotification = {
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    type: params.type,
    title: params.title,
    message: params.message,
    timestamp: new Date().toISOString(),
    read: false,
    referralId: params.referralId,
    partnerId: params.partnerId,
    partnerName: params.partnerName,
    dealValue: params.dealValue,
    commissionValue: params.commissionValue,
    emailSent: shouldSendEmail,
    emailRecipient: shouldSendEmail ? settings.emailAddress : undefined
  };

  // Prepend new notification (keep max 100 entries)
  const updatedList = [notification, ...currentList].slice(0, 100);
  saveNotifications(updatedList);

  return {
    notification,
    emailDispatched: shouldSendEmail,
    emailRecipient: shouldSendEmail ? settings.emailAddress : undefined
  };
}

export function markAsRead(id: string): AppNotification[] {
  const current = loadNotifications();
  const updated = current.map(item => item.id === id ? { ...item, read: true } : item);
  saveNotifications(updated);
  return updated;
}

export function markAllAsRead(): AppNotification[] {
  const current = loadNotifications();
  const updated = current.map(item => ({ ...item, read: true }));
  saveNotifications(updated);
  return updated;
}

export function clearNotifications(): void {
  saveNotifications([]);
}
