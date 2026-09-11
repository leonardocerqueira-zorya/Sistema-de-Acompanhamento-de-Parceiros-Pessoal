import { useState, type FormEvent } from 'react';
import type { AccessState, UserRole, UserProfile } from '../types';
import { Plus, Bell, LogOut, KeyRound, Search, ShieldCheck, Briefcase, Cloud, CloudOff, CloudUpload, RefreshCw } from 'lucide-react';

export type AppTab =
  | 'dashboard'
  | 'referrals'
  | 'commissions'
  | 'partners'
  | 'carteiras'
  | 'sheets'
  | 'audit'
  | 'channel-metrics'
  | 'settings'
  | 'users';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onOpenNewReferral: () => void;
  onOpenNewPartner: () => void;
  incompleteCount: number;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  access: AccessState;
  executives: string[];
  onChangeAccess: (access: AccessState) => void;
  authProfile?: UserProfile | null;
  onLogout?: () => void;
  onOpenSetPassword?: () => void;
  onSearch?: (query: string) => void;
  syncStatus?: 'off' | 'syncing' | 'ok' | 'error';
  lastSyncAt?: string | null;
  /** Linhas salvas neste navegador que ainda não subiram para o banco. */
  pendingWrites?: number;
  onSyncNow?: () => void;
}

export default function Navbar({
  setActiveTab,
  onOpenNewReferral,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  access,
  executives,
  onChangeAccess,
  authProfile = null,
  onLogout,
  onOpenSetPassword,
  onSearch,
  syncStatus = 'off',
  lastSyncAt = null,
  pendingWrites = 0,
  onSyncNow
}: NavbarProps) {
  const [searchDraft, setSearchDraft] = useState('');

  // Busca global: joga o termo no filtro de indicações e leva pra essa aba.
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!onSearch) return;
    onSearch(searchDraft.trim());
    setActiveTab('referrals');
  };

  return (
    <header className="sticky top-0 z-20 bg-zry-surface border-b border-zry-border">
      <div className="h-16 flex items-center gap-3 sm:gap-4 px-4 sm:px-6">
        {/* Marca */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <img src="/brand/marca-zorya-roxa.svg" alt="Zorya" className="h-[18px] w-auto" />
          <div className="hidden sm:block w-px h-[22px] bg-zry-border" />
          <div className="hidden sm:block">
            <div className="text-[13px] font-bold tracking-tight leading-tight text-zry-text">
              Canal de Parcerias
            </div>
            <div className="text-[11px] text-zry-text-2 mt-px">
              Indicações, fechamentos e comissões
            </div>
          </div>
        </div>

        {/* Busca global */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden lg:flex w-[440px] min-w-0 shrink items-center gap-2.5 bg-zry-lilas-30 rounded-full h-9 px-4"
        >
          <Search className="w-[15px] h-[15px] text-zry-text-2 shrink-0" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar parceiro, cliente ou indicação"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-zry-text placeholder:text-zry-text-2"
          />
        </form>

        <div className="flex-1" />

        {/* Estado, alertas e ação primária andam juntos: são o que se faz agora.
            A identidade fica separada por um divisor, na ponta, como em qualquer
            app — é para onde a pessoa vai trocar senha ou sair, não para operar. */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Estado da sincronização com o banco. Fila pendente vira aviso: "sincronizado"
              com linhas presas neste navegador é a mensagem mais perigosa que a barra
              poderia dar — a pessoa fecha o navegador achando que o time já vê tudo. */}
          {syncStatus !== 'off' && (() => {
            const pendente = pendingWrites > 0 && syncStatus === 'ok';
            const rotulo = syncStatus === 'syncing'
              ? 'Sincronizando'
              : syncStatus === 'error'
                ? 'Sem sincronizar'
                : pendente
                  ? `${pendingWrites} a enviar`
                  : lastSyncAt
                    ? new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : 'Sincronizado';
            const descricao = syncStatus === 'syncing'
              ? 'Sincronizando com o banco...'
              : syncStatus === 'error'
                ? `Falha ao sincronizar${pendingWrites > 0 ? ` — ${pendingWrites} alteração(ões) ainda não subiram` : ''}. Seus dados seguem salvos neste navegador. Clique para tentar de novo.`
                : pendente
                  ? `${pendingWrites} alteração(ões) ainda não subiram para o banco — elas só existem neste navegador. Clique para enviar agora.`
                  : lastSyncAt
                    ? `Tudo salvo no banco. Última sincronização às ${new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Clique para sincronizar agora.`
                    : 'Tudo salvo no banco. Clique para sincronizar agora.';

            return (
              <button
                type="button"
                onClick={onSyncNow}
                disabled={syncStatus === 'syncing' || !onSyncNow}
                title={descricao}
                className={`flex items-center gap-1.5 h-9 text-[11px] font-semibold rounded-full px-3 shrink-0 border transition disabled:cursor-default ${
                  syncStatus === 'error'
                    ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                    : pendente
                      ? 'text-zry-warning bg-zry-warning-bg border-zry-warning/20 hover:opacity-80'
                      : 'text-zry-text-2 bg-zry-surface border-zry-border hover:border-zry-border-strong'
                }`}
              >
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : syncStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5" />
                ) : pendente ? (
                  <CloudUpload className="w-3.5 h-3.5" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span className="hidden xl:inline">{rotulo}</span>
              </button>
            );
          })()}

          {/* Notificações */}
          <button
            onClick={onOpenNotifications}
            title="Central de alertas e notificações"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-zry-roxo hover:bg-zry-lilas-30 transition shrink-0"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 bg-zry-coral text-zry-roxo rounded-full text-[9px] font-extrabold flex items-center justify-center">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Ação primária */}
          <button
            onClick={onOpenNewReferral}
            className="flex items-center gap-2 h-9 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-3 sm:px-[18px] rounded-full text-[12.5px] transition shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova indicação</span>
          </button>
        </div>

        <div className="hidden md:block w-px h-6 bg-zry-border shrink-0" />

        {/* Perfil de acesso */}
        {authProfile ? (
          <div className="hidden md:flex items-center gap-1.5 h-9 bg-zry-lilas-30 rounded-full pl-3 pr-1.5 shrink-0">
            {authProfile.role === 'master' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-zry-roxo shrink-0" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-zry-roxo shrink-0" />
            )}
            <span
              className="text-[12px] font-bold text-zry-roxo truncate max-w-[150px]"
              title={authProfile.role === 'master' ? 'Master' : authProfile.executiveName || 'Executivo'}
            >
              {authProfile.role === 'master' ? 'Master' : authProfile.executiveName || 'Executivo'}
            </span>
            {onOpenSetPassword && (
              <button
                onClick={onOpenSetPassword}
                title="Definir senha de acesso"
                className="w-7 h-7 rounded-full flex items-center justify-center text-zry-text-2 hover:text-zry-roxo hover:bg-white transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Sair"
                className="w-7 h-7 rounded-full flex items-center justify-center text-zry-text-2 hover:text-zry-danger hover:bg-white transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-0.5 h-9 bg-zry-lilas-30 rounded-full px-[3px] shrink-0">
            {(['master', 'executivo'] as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() =>
                  onChangeAccess({
                    role,
                    executive: role === 'executivo' ? access.executive || executives[0] || null : null
                  })
                }
                className={`px-3.5 py-[7px] rounded-full text-[12px] font-bold transition ${
                  access.role === role ? 'bg-zry-roxo text-zry-creme' : 'text-zry-text-2 hover:text-zry-roxo'
                }`}
              >
                {role === 'master' ? 'Master' : 'Executivo'}
              </button>
            ))}
            {access.role === 'executivo' && (
              <select
                value={access.executive || ''}
                onChange={(e) => onChangeAccess({ role: 'executivo', executive: e.target.value || null })}
                title="Executivo (carteira exibida)"
                className="bg-transparent text-[12px] font-semibold text-zry-roxo focus:outline-none cursor-pointer max-w-[130px] truncate pl-1 pr-2"
              >
                {executives.length === 0 && <option value="">Sem executivos</option>}
                {executives.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
