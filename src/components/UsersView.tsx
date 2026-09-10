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
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">Usuários &amp; Acesso</h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5 max-w-xl">
            Convide quem pode entrar no sistema. A pessoa recebe um link de acesso por e-mail (sem senha) e, ao clicar, entra direto com o papel definido aqui.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Convite */}
        <div className="bg-zry-surface border border-zry-border rounded-zry-lg">
          <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
            <UserPlus className="w-4 h-4 text-zry-text-2" />
            <h3 className="text-[13px] font-bold text-zry-text">Convidar pessoa</h3>
          </div>

          <div className="px-[22px] py-[18px] space-y-3">
            {errorMsg && (
              <div className="bg-zry-danger-bg text-zry-danger text-[12.5px] px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-zry-danger mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-zry-positive-bg text-zry-positive text-[12.5px] px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-zry-positive mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                <input
                  type="email"
                  required
                  placeholder="e-mail@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zry-lilas-30 border border-transparent rounded-full px-4 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong sm:col-span-1"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="bg-zry-lilas-30 border border-transparent rounded-full px-4 py-2.5 text-[13px] text-zry-text focus:outline-none focus:border-zry-border-strong"
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
                    className="bg-zry-lilas-30 border border-transparent rounded-full px-4 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong"
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
                className="flex items-center justify-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition disabled:opacity-50 whitespace-nowrap"
              >
                {submitting ? 'Enviando...' : 'Convidar'}
              </button>
            </form>
          </div>
        </div>

        {invites.length > 0 && (
          <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
            <div className="px-[22px] py-[18px] border-b border-zry-border flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-zry-text-2" />
              <h3 className="text-[13px] font-bold text-zry-text">Convites Pendentes</h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning">
                {invites.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">E-mail</th>
                    <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Papel</th>
                    <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => (
                    <tr key={inv.email} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                      <td className="py-3.5 px-[22px] text-[13px] font-semibold text-zry-text">{inv.email}</td>
                      <td className="py-3.5 px-[22px] text-[13px] text-zry-text-2">
                        {inv.role === 'master' ? 'Master' : `Executivo (${inv.executiveName})`}
                      </td>
                      <td className="py-3.5 px-[22px] text-[13px] text-right">
                        <button
                          onClick={() => handleRevoke(inv.email)}
                          className="p-2 text-zry-text-2 hover:text-zry-danger hover:bg-zry-lilas-30 rounded-full transition"
                          title="Cancelar convite"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-zry-surface border border-zry-border rounded-zry-lg overflow-hidden">
          <div className="px-[22px] py-[18px] border-b border-zry-border">
            <h3 className="text-[13px] font-bold text-zry-text">Usuários Ativos</h3>
          </div>
          {loading ? (
            <p className="px-[22px] py-[18px] text-[13px] text-zry-text-2">Carregando...</p>
          ) : profiles.length === 0 ? (
            <p className="px-[22px] py-[18px] text-[13px] text-zry-text-2">Nenhum usuário ainda além de você.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">E-mail</th>
                    <th className="text-[11px] uppercase tracking-wider font-semibold text-zry-text-2 py-3 px-[22px]">Papel</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id} className="border-t border-zry-border hover:bg-zry-lilas-30/60 transition">
                      <td className="py-3.5 px-[22px] text-[13px]">
                        <div className="flex items-center gap-2.5">
                          {p.role === 'master' ? (
                            <ShieldCheck className="w-4 h-4 text-zry-warning shrink-0" />
                          ) : (
                            <Briefcase className="w-4 h-4 text-zry-info shrink-0" />
                          )}
                          <span className="font-semibold text-zry-text">{p.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-[22px] text-[13px] text-zry-text-2">
                        {p.role === 'master' ? 'Master' : `Executivo (${p.executiveName})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
