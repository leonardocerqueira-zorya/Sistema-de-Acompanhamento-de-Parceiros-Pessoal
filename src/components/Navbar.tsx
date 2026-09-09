import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from '../services/firebaseAuth';
import type { AccessState, UserRole, UserProfile } from '../types';
import {
  LayoutDashboard,
  Users,
  FileText,
  DollarSign,
  FileSpreadsheet,
  Plus,
  AlertTriangle,
  LogOut,
  CheckCircle,
  HelpCircle,
  Bell,
  Sliders,
  ShieldAlert,
  Briefcase,
  ShieldCheck,
  UserPlus,
  KeyRound
} from 'lucide-react';

export type AppTab = 'dashboard' | 'referrals' | 'commissions' | 'partners' | 'carteiras' | 'sheets' | 'audit' | 'settings' | 'users';

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
}

export default function Navbar({
  activeTab,
  setActiveTab,
  onOpenNewReferral,
  onOpenNewPartner,
  incompleteCount,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  access,
  executives,
  onChangeAccess,
  authProfile = null,
  onLogout,
  onOpenSetPassword
}: NavbarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasToken(Boolean(token));
      },
      () => {
        setUser(null);
        setHasToken(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasToken(true);
      }
    } catch (err) {
      console.error('Falha no login Google:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setHasToken(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-inner">
              <span className="tracking-tighter">CP</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-white tracking-tight leading-none">
                  Canal de Parcerias
                </h1>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  Manual & Auditado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Indicações, Fechamentos & Comissões</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dashboard & KPIs</span>
            </button>

            <button
              id="tab-referrals"
              onClick={() => setActiveTab('referrals')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'referrals'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Indicações</span>
              {incompleteCount > 0 && (
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-semibold">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {incompleteCount}
                </span>
              )}
            </button>

            <button
              id="tab-commissions"
              onClick={() => setActiveTab('commissions')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'commissions'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Comissões</span>
            </button>

            <button
              id="tab-partners"
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'partners'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>Parceiros & Ciclo</span>
            </button>

            <button
              id="tab-carteiras"
              onClick={() => setActiveTab('carteiras')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'carteiras'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
              <span>Carteiras</span>
            </button>

            <button
              id="tab-sheets"
              onClick={() => setActiveTab('sheets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sheets'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Planilhas</span>
            </button>

            <button
              id="tab-audit"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'audit'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Auditoria</span>
              {incompleteCount > 0 && (
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-semibold">
                  {incompleteCount}
                </span>
              )}
            </button>

            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configurações</span>
            </button>

            {authProfile?.role === 'master' && (
              <button
                id="tab-users"
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'users'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Usuários</span>
              </button>
            )}
          </nav>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Access Mode: badge somente-leitura quando há login real (Supabase Auth); dropdown livre só no modo offline/sem Supabase */}
            {authProfile ? (
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-1">
                {authProfile.role === 'master' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <span className="text-[11px] font-bold text-slate-200">
                  {authProfile.role === 'master' ? 'Master' : authProfile.executiveName || 'Executivo'}
                </span>
                <span className="text-[10px] text-slate-500 max-w-[110px] truncate hidden xl:inline">{authProfile.email}</span>
                {onOpenSetPassword && (
                  <button
                    onClick={onOpenSetPassword}
                    title="Definir senha de acesso"
                    className="text-slate-400 hover:text-indigo-400 p-0.5 rounded transition border-l border-slate-700 pl-1.5 ml-0.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sair"
                    className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 rounded-xl px-2 py-1">
                {access.role === 'master' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <select
                  value={access.role}
                  onChange={(e) => {
                    const role = e.target.value as UserRole;
                    onChangeAccess({
                      role,
                      executive: role === 'executivo' ? (access.executive || executives[0] || null) : null
                    });
                  }}
                  className="bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none cursor-pointer"
                  title="Modo de acesso (offline, sem Supabase configurado)"
                >
                  <option className="text-slate-900" value="master">Master</option>
                  <option className="text-slate-900" value="executivo">Executivo</option>
                </select>
                {access.role === 'executivo' && (
                  <select
                    value={access.executive || ''}
                    onChange={(e) => onChangeAccess({ role: 'executivo', executive: e.target.value || null })}
                    className="bg-transparent text-[11px] font-semibold text-indigo-300 focus:outline-none cursor-pointer max-w-[130px] truncate border-l border-slate-700 pl-1.5"
                    title="Executivo (carteira exibida)"
                  >
                    {executives.length === 0 && <option className="text-slate-900" value="">Sem executivos</option>}
                    {executives.map(ex => (
                      <option key={ex} className="text-slate-900" value={ex}>{ex}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Google Account Status */}
            {user ? (
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Usuário'} className="w-5 h-5 rounded-full ring-1 ring-emerald-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-[11px] font-medium text-slate-200 leading-tight max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </p>
                  <p className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Sheets Conectado
                  </p>
                </div>
                <button
                  id="btn-logout-google"
                  onClick={handleLogout}
                  title="Desconectar conta Google"
                  className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="btn-login-google"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-medium px-3 py-1.5 rounded-xl text-xs shadow-sm transition active:scale-98 disabled:opacity-60"
                title="Conectar com Google Sheets com permissão"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span className="hidden sm:inline">{isLoggingIn ? 'Conectando...' : 'Conectar Sheets'}</span>
              </button>
            )}

            {/* Notification Bell with Badge */}
            <button
              id="btn-navbar-notifications"
              onClick={onOpenNotifications}
              title="Central de Alertas e Notificações"
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-800"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white font-extrabold text-[10px] rounded-full ring-2 ring-slate-900 animate-pulse">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Action Buttons */}
            <button
              id="btn-header-new-referral"
              onClick={onOpenNewReferral}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs shadow-sm transition active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Indicação</span>
            </button>
          </div>

        </div>

        {/* Mobile Submenu Navigation */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800 text-xs overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 py-1 rounded ${activeTab === 'dashboard' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`px-2 py-1 rounded flex items-center gap-1 ${activeTab === 'referrals' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Indicações
            {incompleteCount > 0 && <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1 rounded-full">{incompleteCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`px-2 py-1 rounded ${activeTab === 'commissions' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Comissões
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`px-2 py-1 rounded ${activeTab === 'partners' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Parceiros
          </button>
          <button
            onClick={() => setActiveTab('carteiras')}
            className={`px-2 py-1 rounded ${activeTab === 'carteiras' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Carteiras
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`px-2 py-1 rounded ${activeTab === 'sheets' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Planilha
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-2 py-1 rounded flex items-center gap-1 ${activeTab === 'audit' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Auditoria
            {incompleteCount > 0 && <span className="bg-amber-500/30 text-amber-300 text-[10px] px-1 rounded-full">{incompleteCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-2 py-1 rounded ${activeTab === 'settings' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'}`}
          >
            Planos
          </button>
        </div>

      </div>
    </header>
  );
}
