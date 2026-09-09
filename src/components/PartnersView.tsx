import { useState } from 'react';
import type { Partner, Referral } from '../types';
import { calculatePartnerRankings, formatCurrency, formatDateBR } from '../utils/analytics';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  Mail,
  Phone,
  Building,
  ArrowRight
} from 'lucide-react';

interface PartnersViewProps {
  partners: Partner[];
  referrals: Referral[];
  onOpenNewPartner: () => void;
  onEditPartner: (partner: Partner) => void;
  onDeletePartner: (partnerId: string) => void;
  onSelectPartnerForReferrals: (partnerId: string) => void;
}

export default function PartnersView({
  partners,
  referrals,
  onOpenNewPartner,
  onEditPartner,
  onDeletePartner,
  onSelectPartnerForReferrals
}: PartnersViewProps) {
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const rankings = calculatePartnerRankings(referrals, partners);
  const rankingMap = new Map(rankings.map(r => [r.partnerId, r]));

  const filteredPartners = partners.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      
      {/* Top Header & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar parceiro por nome, empresa ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewPartner}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Parceiro</span>
          </button>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map(partner => {
          const stats = rankingMap.get(partner.id);
          const hasMissingJoinDate = !partner.joinedDate;

          return (
            <div 
              key={partner.id} 
              className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
                hasMissingJoinDate ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">
                      {partner.name}
                    </h4>
                    {partner.company && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-slate-400" />
                        {partner.company}
                      </p>
                    )}
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    partner.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' :
                    partner.status === 'onboarding' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {partner.status}
                  </span>
                </div>

                {/* Contact and Join Date */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Entrada no Programa:</span>
                    {partner.joinedDate ? (
                      <span className="font-semibold text-slate-800">{formatDateBR(partner.joinedDate)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Pendente de preenchimento
                      </span>
                    )}
                  </div>

                  {partner.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{partner.email}</span>
                    </div>
                  )}

                  {partner.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{partner.phone}</span>
                    </div>
                  )}
                </div>

                {/* Channel Cycle and Performance Stats */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-medium">Indicações</span>
                    <span className="text-sm font-bold text-slate-800">{stats?.totalReferrals || 0}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-medium">Fechados</span>
                    <span className="text-sm font-bold text-emerald-700">{stats?.wonReferrals || 0}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block font-medium">1ª Indicação</span>
                    <span className="text-xs font-bold text-indigo-700">
                      {stats?.daysToFirstReferral !== null && stats?.daysToFirstReferral !== undefined 
                        ? `${stats.daysToFirstReferral}d` 
                        : '—'}
                    </span>
                  </div>
                </div>

                {stats && stats.wonVolume > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs bg-emerald-50/80 border border-emerald-200/60 p-2 rounded-xl">
                    <span className="text-emerald-800 font-medium">Volume Gerado:</span>
                    <span className="font-extrabold text-emerald-900">{formatCurrency(stats.wonVolume)}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onSelectPartnerForReferrals(partner.id)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>Ver indicações</span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditPartner(partner)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    title="Editar parceiro"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {deleteConfirmId === partner.id ? (
                    <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                      <button
                        onClick={() => {
                          onDeletePartner(partner.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                      >
                        Excluir
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-1 py-0.5 text-slate-500 text-[10px]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(partner.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                      title="Excluir parceiro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
