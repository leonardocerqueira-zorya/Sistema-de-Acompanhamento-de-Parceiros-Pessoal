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
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl border border-zry-border shadow-lg max-w-lg w-full p-6">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zry-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-zry-text">
                Alertas e Notificações (Frontend & E-mail)
              </h3>
              <p className="text-[12px] text-zry-text-2 mt-0.5">
                Receba alertas automáticos sobre novas indicações e comissões
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zry-text-2 hover:text-zry-text hover:bg-zry-lilas-30 rounded-full transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">

          {/* Frontend Notification Notice */}
          <div className="bg-zry-lilas-30 border border-zry-border text-zry-text-2 rounded-zry-lg p-3.5 text-[12px] flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-zry-roxo shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zry-text">Notificações no Frontend Ativas</p>
              <p className="text-zry-text-2 mt-0.5 leading-relaxed">
                Os alertas de novas indicações, alterações de status e comissões a pagar aparecem em tempo real no ícone de sino e na central de notificações.
              </p>
            </div>
          </div>

          {/* Email Integration Box */}
          <div className="bg-zry-lilas-30 border border-zry-border rounded-zry-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zry-text text-[13px]">Notificações Opcionais por E-mail</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailEnabled}
                  onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-zry-lilas peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zry-surface after:border-zry-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zry-roxo"></div>
              </label>
            </div>

            <p className="text-[12px] text-zry-text-2">
              Ative para receber cópia dos avisos comerciais diretamente na sua caixa de entrada.
            </p>

            {settings.emailEnabled && (
              <div className="pt-1">
                <label className="block text-[12px] font-semibold text-zry-text mb-1.5">
                  Endereço de E-mail para Envio *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zry-text-2 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@empresa.com.br"
                    value={settings.emailAddress}
                    onChange={(e) => setSettings({ ...settings, emailAddress: e.target.value })}
                    className="w-full bg-zry-surface border border-transparent rounded-xl pl-10 pr-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trigger events selection */}
          <div className="space-y-1.5 pt-1">
            <span className="block text-[12px] font-semibold text-zry-text mb-1.5">Eventos que acionam alerta:</span>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zry-lilas-30 cursor-pointer transition text-[12px]">
              <input
                type="checkbox"
                checked={settings.notifyNewReferral}
                onChange={(e) => setSettings({ ...settings, notifyNewReferral: e.target.checked })}
                className="mt-0.5 rounded border-zry-border-strong text-zry-roxo focus:ring-zry-roxo"
              />
              <div>
                <span className="font-semibold text-zry-text">Novas indicações recebidas</span>
                <p className="text-zry-text-2">Notifica assim que uma oportunidade for enviada por um parceiro.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zry-lilas-30 cursor-pointer transition text-[12px]">
              <input
                type="checkbox"
                checked={settings.notifyStatusChange}
                onChange={(e) => setSettings({ ...settings, notifyStatusChange: e.target.checked })}
                className="mt-0.5 rounded border-zry-border-strong text-zry-roxo focus:ring-zry-roxo"
              />
              <div>
                <span className="font-semibold text-zry-text">Mudanças de status em negócios</span>
                <p className="text-zry-text-2">Ex: avanço para 'Em Negociação' ou fechamento 'Ganho / Fechado'.</p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zry-lilas-30 cursor-pointer transition text-[12px]">
              <input
                type="checkbox"
                checked={settings.notifyCommissionToPay}
                onChange={(e) => setSettings({ ...settings, notifyCommissionToPay: e.target.checked })}
                className="mt-0.5 rounded border-zry-border-strong text-zry-roxo focus:ring-zry-roxo"
              />
              <div>
                <span className="font-semibold text-zry-text">Quando uma comissão se torna 'A Pagar'</span>
                <p className="text-zry-text-2">Alerta imediatamente quando um negócio ganho aprovar comissão para quitação.</p>
              </div>
            </label>
          </div>

          {/* Test notification feedback */}
          {testSent && testMessage && (
            <div className="bg-zry-positive-bg border border-zry-positive/30 text-zry-positive rounded-zry-lg p-3.5 text-[12px] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-zry-positive shrink-0 mt-0.5" />
              <span>{testMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-zry-border">
            {settings.emailEnabled ? (
              <button
                type="button"
                onClick={handleSendTestEmail}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zry-text-2 hover:text-zry-text bg-zry-lilas-30 hover:bg-zry-lilas px-4 py-2.5 rounded-full transition"
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
                className="text-zry-text-2 hover:text-zry-text font-semibold px-4 py-2.5 rounded-full text-[12.5px] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-5 py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
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
