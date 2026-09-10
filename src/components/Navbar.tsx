import { useState, useEffect, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from '../services/firebaseAuth';
import type { AccessState, UserRole, UserProfile } from '../types';
import { Plus, Bell, LogOut, KeyRound, Search, ShieldCheck, Briefcase, CheckCircle } from 'lucide-react';

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
  onSearch
}: NavbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [searchDraft, setSearchDraft] = useState('');

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => setUser(currentUser),
      () => setUser(null)
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) setUser(res.user);
    } catch (err) {
      console.error('Falha no login Google:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setUser(null);
  };

  // Busca global: joga o termo no filtro de indicações e leva pra essa aba.
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!onSearch) return;
    onSearch(searchDraft.trim());
    setActiveTab('referrals');
  };

  return (
    <header className="sticky top-0 z-20 bg-zry-surface border-b border-zry-border">
      <div className="h-16 flex items-center gap-3 sm:gap-5 px-4 sm:px-7">
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
          className="hidden lg:flex flex-1 max-w-[460px] mx-2 items-center gap-2.5 bg-zry-lilas-30 rounded-full px-4 py-2.5"
        >
          <Search className="w-[15px] h-[15px] text-zry-text-2 shrink-0" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar parceiro, cliente ou indicação"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] text-zry-text placeholder:text-zry-text-2"
          />
        </form>

        <div className="flex-1 lg:flex-none" />

        {/* Perfil de acesso */}
        {authProfile ? (
          <div className="hidden md:flex items-center gap-1.5 bg-zry-lilas-30 rounded-full pl-3 pr-1.5 py-1 shrink-0">
            {authProfile.role === 'master' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-zry-roxo shrink-0" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-zry-roxo shrink-0" />
            )}
            <span className="text-[12px] font-bold text-zry-roxo">
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
          <div className="hidden md:flex items-center gap-0.5 bg-zry-lilas-30 rounded-full p-[3px] shrink-0">
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

        {/* Conexão Google Sheets */}
        {user ? (
          <button
            onClick={handleGoogleLogout}
            title={`${user.email} — desconectar Google Sheets`}
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-zry-positive bg-zry-positive-bg border border-zry-positive/20 rounded-full px-3 py-2 shrink-0 hover:opacity-80 transition"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Sheets conectado</span>
          </button>
        ) : (
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            title="Conectar com Google Sheets"
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-zry-text-2 bg-zry-surface border border-zry-border rounded-full px-3 py-2 shrink-0 hover:text-zry-roxo hover:border-zry-border-strong transition disabled:opacity-60"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span className="hidden xl:inline">{isLoggingIn ? 'Conectando...' : 'Conectar Sheets'}</span>
          </button>
        )}

        {/* Notificações */}
        <button
          onClick={onOpenNotifications}
          title="Central de alertas e notificações"
          className="relative w-[38px] h-[38px] rounded-full flex items-center justify-center text-zry-roxo hover:bg-zry-lilas-30 transition shrink-0"
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
          className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-3 sm:px-[18px] py-2.5 rounded-full text-[12.5px] transition shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova indicação</span>
        </button>
      </div>
    </header>
  );
}
