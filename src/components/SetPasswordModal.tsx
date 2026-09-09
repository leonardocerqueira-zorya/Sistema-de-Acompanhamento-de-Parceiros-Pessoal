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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Definir Senha de Acesso</h3>
              <p className="text-xs text-slate-500">
                {userEmail ? `Para ${userEmail} — ` : ''}permite entrar direto com senha, sem depender do link por e-mail.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
        </div>

        {status === 'saved' ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>Senha definida com sucesso! Da próxima vez você pode entrar direto pela aba "Senha" no login.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nova senha *</label>
              <input
                type="password"
                required
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Confirmar nova senha *</label>
              <input
                type="password"
                required
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {pending.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <ul className="space-y-0.5">
                  {pending.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}

            {status === 'error' && errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!canSubmit || status === 'saving'}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xs transition disabled:opacity-50"
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
