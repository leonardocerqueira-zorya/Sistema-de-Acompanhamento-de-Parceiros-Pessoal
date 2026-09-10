import { useState, useEffect, type FormEvent } from 'react';
import { KeyRound, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { setOwnPassword } from '../services/authService';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

const MIN_PASSWORD_LENGTH = 6;

export default function SetPasswordModal({ isOpen, onClose, userEmail }: SetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setStatus('idle');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Pendências guiam a pessoa a completar antes de deixar submeter, em vez de
  // só falhar depois de tentar salvar.
  const pending: string[] = [];
  if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
    pending.push(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (password && confirmPassword && password !== confirmPassword) {
    pending.push('As senhas não coincidem.');
  }
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('saving');
    setErrorMsg(null);
    const { error } = await setOwnPassword(password);
    if (error) {
      setStatus('error');
      setErrorMsg(error);
    } else {
      setStatus('saved');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zry-roxo/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zry-surface rounded-zry-xl border border-zry-border shadow-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between border-b border-zry-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zry-lilas-30 text-zry-roxo flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-zry-text">Definir Senha de Acesso</h3>
              <p className="text-[12px] text-zry-text-2 mt-0.5">
                {userEmail ? `Para ${userEmail} — ` : ''}permite entrar direto com senha, sem depender do link por e-mail.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zry-text-2 hover:text-zry-text font-bold text-sm w-8 h-8 rounded-full hover:bg-zry-lilas-30 transition shrink-0"
          >
            ✕
          </button>
        </div>

        {status === 'saved' ? (
          <div className="bg-zry-positive-bg border border-zry-positive/30 text-zry-positive text-[12px] p-3.5 rounded-zry-lg flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-zry-positive mt-0.5" />
            <span>Senha definida com sucesso! Da próxima vez você pode entrar direto pela aba "Senha" no login.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Nova senha *</label>
              <input
                type="password"
                required
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-zry-text mb-1.5">Confirmar nova senha *</label>
              <input
                type="password"
                required
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zry-lilas-30 border border-transparent rounded-xl px-3.5 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong focus:bg-zry-surface transition"
              />
            </div>

            {pending.length > 0 && (
              <div className="bg-zry-warning-bg border border-zry-warning/30 text-zry-warning rounded-zry-lg p-3.5 text-[12px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-zry-warning mt-0.5" />
                <ul className="space-y-0.5">
                  {pending.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}

            {status === 'error' && errorMsg && (
              <div className="bg-zry-danger-bg border border-zry-danger/30 text-zry-danger rounded-zry-lg p-3.5 text-[12px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-zry-danger mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zry-border">
              <button
                type="button"
                onClick={onClose}
                className="text-zry-text-2 hover:text-zry-text font-semibold px-4 py-2.5 rounded-full text-[12.5px] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit || status === 'saving'}
                className="bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-5 py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50"
              >
                {status === 'saving' ? 'Salvando...' : 'Salvar Senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
