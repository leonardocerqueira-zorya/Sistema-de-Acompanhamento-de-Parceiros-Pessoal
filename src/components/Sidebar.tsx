import type { AppTab } from './Navbar';
import type { UserProfile } from '../types';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  Users,
  Briefcase,
  FileSpreadsheet,
  ShieldAlert,
  Wallet,
  Sliders,
  UserPlus
} from 'lucide-react';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  incompleteCount: number;
  authProfile?: UserProfile | null;
  isMaster: boolean;
}

interface NavItem {
  id: AppTab;
  label: string;
  Icon: typeof LayoutDashboard;
  badge?: number;
}

// Iniciais para o avatar do rodapé (a partir do e-mail ou do nome do executivo).
function initialsFor(profile?: UserProfile | null): string {
  const source = (profile?.executiveName || profile?.email || '').trim();
  if (!source) return '—';
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  incompleteCount,
  authProfile = null,
  isMaster
}: SidebarProps) {
  const items: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard & KPIs', Icon: LayoutDashboard },
    { id: 'referrals', label: 'Indicações', Icon: FileText, badge: incompleteCount },
    { id: 'commissions', label: 'Comissões', Icon: DollarSign },
    { id: 'partners', label: 'Parceiros', Icon: Users },
    { id: 'carteiras', label: 'Carteiras', Icon: Briefcase },
    { id: 'sheets', label: 'Planilhas', Icon: FileSpreadsheet },
    { id: 'audit', label: 'Auditoria', Icon: ShieldAlert, badge: incompleteCount },
    // Indicadores (CAC/CAP/Ticket Médio) visíveis pra todos; só o preenchimento
    // do custo do canal e do novo MRR (dado do financeiro) é master-only —
    // gate fica dentro da própria tela, não na navegação.
    { id: 'channel-metrics', label: 'Custos & MRR', Icon: Wallet },
    { id: 'settings', label: 'Configurações', Icon: Sliders }
  ];

  if (isMaster && authProfile) {
    items.push({ id: 'users', label: 'Usuários', Icon: UserPlus });
  }

  return (
    <>
      {/* Rail vertical (desktop) */}
      <nav className="hidden sm:flex fixed left-0 top-0 bottom-0 w-16 z-30 bg-zry-roxo flex-col items-center py-4 gap-1.5">
        <div className="w-8 h-8 flex items-center justify-center mb-2.5 shrink-0">
          <img src="/brand/icone-zorya.svg" alt="Zorya" className="w-7 h-7" />
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          {items.map(({ id, label, Icon, badge }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative w-[42px] h-[42px] rounded-2xl flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-white/12 text-zry-coral'
                    : 'text-white/55 hover:text-white hover:bg-white/8'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 bg-zry-coral text-zry-roxo rounded-full text-[9px] font-extrabold flex items-center justify-center">
                    {badge > 99 ? '99' : badge}
                  </span>
                )}

                {/* Nome da aba ao passar o mouse. Substitui o tooltip nativo do
                    navegador (title), que só aparece depois de ~1s. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-xl bg-zry-roxo border border-white/15 px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-lg opacity-0 translate-x-[-4px] transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0"
                >
                  {label}
                  <span className="absolute right-full top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-zry-roxo" />
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="w-[34px] h-[34px] rounded-full bg-zry-coral text-zry-roxo flex items-center justify-center text-[12px] font-bold shrink-0"
          title={authProfile?.email || 'Sessão local'}
        >
          {initialsFor(authProfile)}
        </div>
      </nav>

      {/* Barra de navegação horizontal (mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-zry-roxo flex items-center justify-between px-2 py-1.5 overflow-x-auto gap-1">
        {items.map(({ id, label, Icon, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={label}
              aria-label={label}
              className={`relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isActive ? 'bg-white/12 text-zry-coral' : 'text-white/55'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {badge !== undefined && badge > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 bg-zry-coral text-zry-roxo rounded-full text-[8px] font-extrabold flex items-center justify-center">
                  {badge > 99 ? '99' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
