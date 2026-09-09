import { useState, useEffect, type FormEvent } from 'react';
import type { NotificationSettings } from '../types';
import { 
  loadNotificationSettings, 
  saveNotificationSettings, 
  dispatchNotification 
} from '../services/notificationService';
import { 
  Mail, 
  Bell, 
  Check, 
  Send, 
  ShieldCheck, 
  Info, 
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedSettings?: () => void;
}

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  onSavedSettings
}: NotificationSettingsModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>(loadNotificationSettings());
  const [testSent, setTestSent] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadNotificationSettings());
      setTestSent(false);
      setTestMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveNotificationSettings(settings);
    if (onSavedSettings) onSavedSettings();
    onClose();
  };

  const handleSendTestEmail = () => {
    if (!settings.emailAddress || !settings.emailAddress.includes('@')) {
      alert('Por favor, informe um endereço de e-mail válido para testar a notificação.');
      return;
    }

    saveNotificationSettings(settings);

    const res = dispatchNotification({
      type: 'nova_indicacao',
      title: 'Notificação de Teste do Canal de Parcerias',
      message: `Este é um teste do sistema de alertas enviado para ${settings.emailAddress}. O monitoramento de novas indicações, mudanças de status e comissões está ativo.`,
      partnerName: 'Parceiro Exemplo',
      dealValue: 25000,
      commissionValue: 2500
    });

    setTestSent(true);
    setTestMessage(`Alerta de teste gerado com sucesso! Notificação registrada no frontend e despacho enviado para ${settings.emailAddress}.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Alertas e Notificações (Frontend & E-mail)
              </h3>
              <p className="text-xs text-slate-500">
                Receba alertas automáticos sobre novas indicações e comissões
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4 text-xs">
          
          {/* Frontend Notification Notice */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Notificações no Frontend Ativas</p>
              <p className="text-slate-500 mt-0.5">
                Os alertas de novas indicações, alterações de status e comissões a pagar aparecem em tempo real no ícone de sino e na central de notificações.
              </p>
            </div>
          </div>

          {/* Email Integration Box */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-950 text-sm">Notificações Opcionais por E-mail</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-emerald-800">
              Ative para receber cópia dos avisos comerciais diretamente na sua caixa de entrada.
            </p>

            {settings.emailEnabled && (
              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Endereço de E-mail para Envio *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@empresa.com.br"
                    value={settings.emailAddress}
                    onChange={(e) => setSettings({ ...settings, emailAddress: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trigger events selection */}
          <div className="space-y-2 pt-1">
            <span className="font-bold text-slate-700 block">Eventos que acionam alerta:</span>

            <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={settings.notifyNewReferral}
                onChange={(e) => setSettings({ ...settings, notifyNewReferral: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-800">Novas indicações recebidas</span>
                <p className="text-slate-500">Notifica assim que uma oportunidade for enviada por um parceiro.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={settings.notifyStatusChange}
                onChange={(e) => setSettings({ ...settings, notifyStatusChange: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-800">Mudanças de status em negócios</span>
                <p className="text-slate-500">Ex: avanço para 'Em Negociação' ou fechamento 'Ganho / Fechado'.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                checked={settings.notifyCommissionToPay}
                onChange={(e) => setSettings({ ...settings, notifyCommissionToPay: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-slate-800">Quando uma comissão se torna 'A Pagar'</span>
                <p className="text-slate-500">Alerta imediatamente quando um negócio ganho aprovar comissão para quitação.</p>
              </div>
            </label>
          </div>

          {/* Test notification feedback */}
          {testSent && testMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{testMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {settings.emailEnabled ? (
              <button
                type="button"
                onClick={handleSendTestEmail}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Teste</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-xs transition"
              >
                Salvar Preferências
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
