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
    switch (type) {
      case 'nova_indicacao':
        return (
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
      case 'mudanca_status':
        return (
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'comissao_a_pagar':
        return (
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case 'comissao_paga':
        return (
          <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        );
      case 'corte_safra_alerta':
        return (
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-100 text-slate-600 rounded-xl shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Central de Alertas & Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} nova(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Novas indicações, alterações de status e comissões liberadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              title="Configurações de Alertas e Notificações por E-mail"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterType === 'unread'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Não lidas ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar lidas</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
                title="Limpar histórico de notificações"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {displayed.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2 opacity-50" />
              <p className="font-semibold text-slate-600">Nenhum alerta para exibir.</p>
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
                  className={`p-4 rounded-2xl border transition-all text-xs flex items-start gap-3 ${
                    item.read
                      ? 'bg-white border-slate-200/80 opacity-80 hover:opacity-100'
                      : 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                  }`}
                >
                  {getIcon(item.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 leading-tight truncate">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>

                    <p className="text-slate-600 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100/80">
                      {item.dealValue !== undefined && item.dealValue > 0 && (
                        <span className="font-bold text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded text-[10px]">
                          Contrato: {formatCurrency(item.dealValue)}
                        </span>
                      )}

                      {item.commissionValue !== undefined && item.commissionValue > 0 && (
                        <span className="font-bold text-purple-800 bg-purple-100/60 px-2 py-0.5 rounded text-[10px]">
                          Comissão: {formatCurrency(item.commissionValue)}
                        </span>
                      )}

                      {item.emailSent && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          <Mail className="w-3 h-3 text-emerald-600" />
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
                          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-0.5 ml-auto"
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
                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-0.5 ml-auto"
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={onOpenSettings}
            className="text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-medium"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-600" />
            <span>Configurar E-mail & Alertas</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
