import { useState, type FormEvent } from 'react';
import { Mail, ShieldCheck, Send, CheckCircle2, AlertTriangle, KeyRound, LogIn } from 'lucide-react';
import { sendMagicLink, signInWithPassword } from '../services/authService';

interface LoginProps {
  deniedMessage?: string | null;
}

export default function Login({ deniedMessage }: LoginProps) {
  const [mode, setMode] = useState<'link' | 'password'>('link');

  // Magic link state
  const [email, setEmail] = useState('');
  const [linkStatus, setLinkStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Password login state
  const [pwEmail, setPwEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [pwError, setPwError] = useState<string | null>(null);

  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLinkStatus('sending');
    setLinkError(null);
    const { error } = await sendMagicLink(email);
    if (error) {
      setLinkStatus('error');
      setLinkError(error);
    } else {
      setLinkStatus('sent');
    }
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwEmail.trim() || !password) return;
    setPwStatus('sending');
    setPwError(null);
    const { error } = await signInWithPassword(pwEmail, password);
    if (error) {
      setPwStatus('error');
      setPwError(
        error.toLowerCase().includes('invalid login credentials')
          ? 'E-mail ou senha incorretos. Se você nunca definiu uma senha, entre pelo Link por E-mail e depois defina uma em "Definir senha" no menu superior.'
          : error
      );
    }
    // Sucesso: o listener onAuthStateChange no App.tsx assume a sessão automaticamente.
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Canal de Parcerias</h1>
          <p className="text-xs text-slate-500">Entre com o e-mail cadastrado pelo Master.</p>
        </div>

        {deniedMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{deniedMessage}</span>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              mode === 'link' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Link por E-mail</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              mode === 'password' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Senha</span>
          </button>
        </div>

        {mode === 'link' ? (
          linkStatus === 'sent' ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>Link enviado para <strong>{email}</strong>. Abra seu e-mail e clique no link para entrar.</span>
            </div>
          ) : (
            <form onSubmit={handleSendLink} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {linkStatus === 'error' && linkError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{linkError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={linkStatus === 'sending'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-xs transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{linkStatus === 'sending' ? 'Enviando...' : 'Enviar link de acesso'}</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                Sem senha configurada ainda? Use esta opção — depois de entrar, defina uma senha no menu superior.
              </p>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="seu.email@empresa.com"
                value={pwEmail}
                onChange={(e) => setPwEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {pwStatus === 'error' && pwError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{pwError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwStatus === 'sending'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-xs transition disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{pwStatus === 'sending' ? 'Entrando...' : 'Entrar'}</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Ainda não tem senha? Entre pelo Link por E-mail e defina uma depois no menu superior.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
