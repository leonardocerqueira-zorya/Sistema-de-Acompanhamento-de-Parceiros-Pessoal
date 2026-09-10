import { useState } from 'react';
import type { AppNotification } from '../types';
import { formatCurrency, formatDateBR } from '../utils/analytics';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  Mail, 
  Check, 
  Trash2, 
  Settings, 
  X,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  onNavigateToReferral?: (referralId?: string) => void;
  onNavigateToCommissions?: () => void;
}

export default function NotificationCenterModal({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onOpenSettings,
  onNavigateToReferral,
  onNavigateToCommissions
}: NotificationCenterModalProps) {
  const [filterType, setFilterType] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayed = filterType === 'unread' 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return iso;
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    const box = 'w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0';
    switch (type) {
      case 'nova_indicacao':
        return (
          <div className={box}>
            <Bell className="w-4 h-4" />
          </div>
        );
      case 'mudanca_status':
        return (
          <div className={box}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'comissao_a_pagar':
        return (
          <div className={box}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'comissao_paga':
        return (
          <div className={box}>
            <DollarSign className="w-4 h-4" />
          </div>
        );
      case 'corte_safra_alerta':
        return (
          <div className={box}>
            <Clock className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className={box}>
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl border border-zry-border shadow-lg max-w-xl w-full max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-zry-border flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-zry-text">
                  Central de Alertas & Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-zry-coral text-zry-roxo text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} nova(s)
                  </span>
                )}
              </div>
              <p className="text-[12px] text-zry-text-2 mt-0.5">
                Novas indicações, alterações de status e comissões liberadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenSettings}
              title="Configurações de Alertas e Notificações por E-mail"
              className="w-8 h-8 flex items-center justify-center text-zry-text-2 hover:text-zry-text hover:bg-zry-lilas-30 rounded-full transition"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-zry-text-2 hover:text-zry-text hover:bg-zry-lilas-30 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className="px-6 py-3 border-b border-zry-border flex items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-1 bg-zry-lilas-30 p-1 rounded-full">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
                filterType === 'all'
                  ? 'bg-zry-roxo text-zry-creme'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
                filterType === 'unread'
                  ? 'bg-zry-roxo text-zry-creme'
                  : 'text-zry-text-2 hover:text-zry-text'
              }`}
            >
              Não lidas ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-zry-text-2 hover:text-zry-text font-semibold flex items-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar lidas</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-zry-text-2 hover:text-zry-danger transition flex items-center gap-1"
                title="Limpar histórico de notificações"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {displayed.length === 0 ? (
            <div className="text-center py-12 text-zry-text-2 text-[12px]">
              <Bell className="w-8 h-8 mx-auto text-zry-text-2 mb-2 opacity-50" />
              <p className="font-semibold text-zry-text-2">Nenhum alerta para exibir.</p>
              <p className="mt-0.5">Novas indicações e comissões registradas aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            displayed.map(item => {
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.read) onMarkAsRead(item.id);
                  }}
                  className={`bg-zry-surface rounded-zry-lg p-4 border transition-all text-[12px] flex items-start gap-3 ${
                    item.read
                      ? 'border-zry-border opacity-80 hover:opacity-100'
                      : 'border-zry-coral'
                  }`}
                >
                  {getIcon(item.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-zry-text leading-tight truncate flex items-center gap-2">
                        {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-zry-coral shrink-0" />}
                        <span className="truncate">{item.title}</span>
                      </h4>
                      <span className="text-[10px] text-zry-text-2 shrink-0">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-zry-text-2 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-zry-border">
                      {item.dealValue !== undefined && item.dealValue > 0 && (
                        <span className="font-bold text-zry-positive bg-zry-positive-bg px-2 py-0.5 rounded-full text-[10px]">
                          Contrato: {formatCurrency(item.dealValue)}
                        </span>
                      )}

                      {item.commissionValue !== undefined && item.commissionValue > 0 && (
                        <span className="font-bold text-zry-info bg-zry-info-bg px-2 py-0.5 rounded-full text-[10px]">
                          Comissão: {formatCurrency(item.commissionValue)}
                        </span>
                      )}

                      {item.emailSent && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zry-text-2 bg-zry-lilas-30 px-2 py-0.5 rounded-full">
                          <Mail className="w-3 h-3 text-zry-text-2" />
                          E-mail despachado ({item.emailRecipient})
                        </span>
                      )}

                      {/* Quick Navigate Links */}
                      {item.type === 'comissao_a_pagar' && onNavigateToCommissions && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToCommissions();
                            onClose();
                          }}
                          className="text-[10px] font-bold text-zry-roxo hover:underline flex items-center gap-0.5 ml-auto"
                        >
                          Ir para Comissões &rarr;
                        </button>
                      )}

                      {['nova_indicacao', 'mudanca_status'].includes(item.type) && onNavigateToReferral && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToReferral(item.referralId);
                            onClose();
                          }}
                          className="text-[10px] font-bold text-zry-roxo hover:underline flex items-center gap-0.5 ml-auto"
                        >
                          Ver no Pipeline &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zry-border flex items-center justify-between gap-3 text-[12px]">
          <button
            onClick={onOpenSettings}
            className="text-zry-text-2 hover:text-zry-text flex items-center gap-1.5 font-semibold transition"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Configurar E-mail & Alertas</span>
          </button>

          <button
            onClick={onClose}
            className="bg-zry-roxo hover:bg-zry-roxo-hover text-zry-creme font-bold px-5 py-2.5 rounded-full text-[12.5px] transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
