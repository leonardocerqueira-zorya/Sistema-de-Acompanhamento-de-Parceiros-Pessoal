import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus, ShieldCheck, Briefcase, Trash2, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { UserProfile, PendingInvite, UserRole } from '../types';
import { listProfiles, listPendingInvites, inviteUser, revokePendingInvite } from '../services/authService';

interface UsersViewProps {
  currentUserId: string;
  executiveSuggestions: string[];
}

export default function UsersView({ currentUserId, executiveSuggestions }: UsersViewProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('executivo');
  const [executiveName, setExecutiveName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, i] = await Promise.all([listProfiles(), listPendingInvites()]);
      setProfiles(p);
      setInvites(i);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (role === 'executivo' && !executiveName.trim()) {
      setErrorMsg('Informe o nome do executivo para vincular a carteira.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const { error } = await inviteUser({
      email,
      role,
      executiveName: role === 'executivo' ? executiveName.trim() : null,
      invitedBy: currentUserId
    });
    setSubmitting(false);
    if (error) {
      setErrorMsg(error);
      return;
    }
    setSuccessMsg(`Convite enviado para ${email}. A pessoa recebe um link de acesso por e-mail.`);
    setEmail('');
    setExecutiveName('');
    refresh();
  };

  const handleRevoke = async (inviteEmail: string) => {
    try {
      await revokePendingInvite(inviteEmail);
      refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao remover convite.');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
            <UserPlus className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Usuários & Acesso</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Convide quem pode entrar no sistema. A pessoa recebe um link de acesso por e-mail (sem senha) e, ao clicar, entra direto com o papel definido aqui.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
            <input
              type="email"
              required
              placeholder="e-mail@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:col-span-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="executivo">Executivo</option>
              <option value="master">Master</option>
            </select>
            {role === 'executivo' ? (
              <input
                type="text"
                required
                list="executive-suggestions"
                placeholder="Nome do executivo (carteira)"
                value={executiveName}
                onChange={(e) => setExecutiveName(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            ) : (
              <div className="hidden sm:block" />
            )}
            <datalist id="executive-suggestions">
              {executiveSuggestions.map(name => <option key={name} value={name} />)}
            </datalist>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'Enviando...' : 'Convidar'}
          </button>
        </form>
      </div>

      {invites.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Convites Pendentes
          </h4>
          {invites.map(inv => (
            <div key={inv.email} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{inv.email}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{inv.role === 'master' ? 'Master' : `Executivo (${inv.executiveName})`}</span>
              </div>
              <button
                onClick={() => handleRevoke(inv.email)}
                className="text-rose-500 hover:text-rose-700"
                title="Cancelar convite"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuários Ativos</h4>
        {loading ? (
          <p className="text-xs text-slate-400">Carregando...</p>
        ) : profiles.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum usuário ainda além de você.</p>
        ) : (
          profiles.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                {p.role === 'master' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                )}
                <span className="font-semibold text-slate-800">{p.email}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{p.role === 'master' ? 'Master' : `Executivo (${p.executiveName})`}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
