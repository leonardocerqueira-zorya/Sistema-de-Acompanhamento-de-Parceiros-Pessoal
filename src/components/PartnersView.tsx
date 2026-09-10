import { useState } from 'react';
import type { Partner, Referral } from '../types';
import { calculatePartnerRankings, formatCurrency, formatDateBR } from '../utils/analytics';
import {
  calculatePartnerEngagement,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_BADGE
} from '../utils/partnerEngagement';
import EngagementBar from './EngagementBar';
import {
  Plus,
  Edit3,
  Trash2,
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    <div>

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-zry-text leading-none">Parceiros</h1>
          <p className="text-[13px] text-zry-text-2 mt-1.5">
            {filteredPartners.length} de {partners.length} parceiro(s) cadastrado(s)
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar parceiro por nome, empresa ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-80 bg-zry-lilas-30 border border-transparent rounded-full px-4 py-2.5 text-[13px] text-zry-text placeholder:text-zry-text-2 focus:outline-none focus:border-zry-border-strong"
          />
          <button
            onClick={onOpenNewPartner}
            className="flex items-center gap-2 bg-zry-coral hover:bg-zry-coral-dark text-zry-roxo font-bold px-[18px] py-2.5 rounded-full text-[12.5px] transition"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Parceiro</span>
          </button>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map(partner => {
          const stats = rankingMap.get(partner.id);
          const hasMissingJoinDate = !partner.joinedDate;
          const engagement = calculatePartnerEngagement(partner, referrals);

          return (
            <div
              key={partner.id}
              className={`bg-zry-surface rounded-zry-lg p-5 border flex flex-col justify-between transition ${
                hasMissingJoinDate ? 'border-zry-warning/40' : 'border-zry-border hover:border-zry-border-strong'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-zry-lilas text-zry-roxo font-bold text-[12px] flex items-center justify-center shrink-0">
                      {getInitials(partner.name)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[15px] font-bold text-zry-text leading-tight truncate">
                        {partner.name}
                      </h4>
                      {partner.company && (
                        <p className="text-[12.5px] text-zry-text-2 flex items-center gap-1.5 mt-0.5 truncate">
                          <Building className="w-3.5 h-3.5 text-zry-text-2 shrink-0" />
                          <span className="truncate">{partner.company}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${PARTNER_STATUS_BADGE[partner.status]}`}>
                      {PARTNER_STATUS_LABEL[partner.status]}
                    </span>
                    {partner.hasSignedContract !== undefined && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${
                        partner.hasSignedContract ? 'bg-zry-positive-bg text-zry-positive' : 'bg-zry-danger-bg text-zry-danger'
                      }`}>
                        {partner.hasSignedContract ? 'Contrato assinado' : 'Sem contrato'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact and Join Date */}
                <div className="mt-4 space-y-2 text-[12.5px] text-zry-text-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-zry-text-2 shrink-0" />
                    <span>Entrada no Programa:</span>
                    {partner.joinedDate ? (
                      <span className="font-semibold text-zry-text">{formatDateBR(partner.joinedDate)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zry-warning-bg text-zry-warning">
                        <AlertTriangle className="w-3 h-3" />
                        Pendente de preenchimento
                      </span>
                    )}
                  </div>

                  {partner.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-zry-text-2 shrink-0" />
                      <span className="truncate">{partner.email}</span>
                    </div>
                  )}

                  {partner.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-zry-text-2 shrink-0" />
                      <span>{partner.phone}</span>
                    </div>
                  )}
                </div>

                {/* Engajamento: decai com o tempo e sobe a cada indicação. */}
                <div className="mt-4 pt-4 border-t border-zry-border">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] text-zry-text-2 font-medium">Engajamento</span>
                    <span className="text-[11px] text-zry-text-2">
                      {engagement.daysSinceLastReferral === null
                        ? 'Nunca indicou'
                        : `Última indicação: ${engagement.daysSinceLastReferral}d`}
                    </span>
                  </div>
                  <EngagementBar score={engagement.score} level={engagement.level} />
                </div>

                {/* Channel Cycle and Performance Stats */}
                <div className="mt-4 pt-4 border-t border-zry-border grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zry-lilas-30 rounded-xl p-2.5">
                    <span className="text-[11px] text-zry-text-2 block font-medium">Indicações</span>
                    <span className="text-[15px] font-bold text-zry-text">{stats?.totalReferrals || 0}</span>
                  </div>
                  <div className="bg-zry-lilas-30 rounded-xl p-2.5">
                    <span className="text-[11px] text-zry-text-2 block font-medium">Fechados</span>
                    <span className="text-[15px] font-bold text-zry-positive">{stats?.wonReferrals || 0}</span>
                  </div>
                  <div className="bg-zry-lilas-30 rounded-xl p-2.5">
                    <span className="text-[11px] text-zry-text-2 block font-medium">1ª Indicação</span>
                    <span className="text-[15px] font-bold text-zry-text">
                      {stats?.daysToFirstReferral !== null && stats?.daysToFirstReferral !== undefined
                        ? `${stats.daysToFirstReferral}d`
                        : '—'}
                    </span>
                  </div>
                </div>

                {stats && stats.wonVolume > 0 && (
                  <div className="mt-3 flex items-center justify-between text-[12.5px] bg-zry-positive-bg px-3 py-2.5 rounded-xl">
                    <span className="text-zry-positive font-medium">Volume Gerado:</span>
                    <span className="font-bold text-zry-positive">{formatCurrency(stats.wonVolume)}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-4 border-t border-zry-border flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectPartnerForReferrals(partner.id)}
                  className="border border-zry-border-strong text-zry-roxo font-semibold px-3.5 py-[7px] rounded-full text-[12px] hover:bg-zry-lilas-30 transition flex items-center gap-1.5"
                >
                  <span>Ver indicações</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEditPartner(partner)}
                    className="p-2 text-zry-text-2 hover:text-zry-roxo hover:bg-zry-lilas-30 rounded-full transition"
                    title="Editar parceiro"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {deleteConfirmId === partner.id ? (
                    <div className="flex items-center gap-1 bg-zry-danger-bg px-1.5 py-1 rounded-full">
                      <button
                        onClick={() => {
                          onDeletePartner(partner.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2.5 py-1 bg-zry-danger text-zry-creme rounded-full text-[11px] font-bold"
                      >
                        Excluir
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-zry-text-2 text-[11px] font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(partner.id)}
                      className="p-2 text-zry-text-2 hover:text-zry-danger hover:bg-zry-lilas-30 rounded-full transition"
                      title="Excluir parceiro"
                    >
                      <Trash2 className="w-4 h-4" />
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
