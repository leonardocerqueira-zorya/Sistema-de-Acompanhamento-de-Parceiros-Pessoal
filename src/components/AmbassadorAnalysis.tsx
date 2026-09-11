import { useMemo, useState } from 'react';
import type { Partner, Referral } from '../types';
import { Award, ChevronDown, ChevronUp, Network, TrendingUp, Users } from 'lucide-react';

interface AmbassadorAnalysisProps {
  partners: Partner[];
  referrals: Referral[];
  onSelectPartner: (partnerId: string) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const referralMrr = (referral: Referral) => referral.mrrNet ?? referral.dealValue ?? 0;
const isWon = (referral: Referral) => referral.dealStatus === 'ganho';

export default function AmbassadorAnalysis({
  partners,
  referrals,
  onSelectPartner
}: AmbassadorAnalysisProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const report = useMemo(() => {
    const partnerById = new Map(partners.map(partner => [partner.id, partner]));
    const ambassadorIds = new Set<string>();

    partners.forEach(partner => {
      if ((partner.tier || '').toLocaleLowerCase('pt-BR').includes('embaixador')) {
        ambassadorIds.add(partner.id);
      }
      if (partner.ambassadorId) ambassadorIds.add(partner.ambassadorId);
    });
    referrals.forEach(referral => {
      if (referral.ambassadorId) ambassadorIds.add(referral.ambassadorId);
    });

    return Array.from(ambassadorIds).map(ambassadorId => {
      const ambassador = partnerById.get(ambassadorId);
      const associatedPartners = partners.filter(partner => partner.ambassadorId === ambassadorId);
      const associatedIds = new Set(associatedPartners.map(partner => partner.id));
      const directReferrals = referrals.filter(referral => referral.partnerId === ambassadorId);
      const networkReferrals = referrals.filter(referral => associatedIds.has(referral.partnerId));
      const directWon = directReferrals.filter(isWon);
      const networkWon = networkReferrals.filter(isWon);
      const snapshotName = referrals.find(referral =>
        referral.ambassadorId === ambassadorId && referral.ambassadorName
      )?.ambassadorName;

      return {
        id: ambassadorId,
        name: ambassador?.name || snapshotName || 'Embaixador não identificado',
        ambassadorVisible: Boolean(ambassador),
        associatedPartners,
        directReferrals,
        networkReferrals,
        directWon,
        networkWon,
        directMrr: directWon.reduce((sum, referral) => sum + referralMrr(referral), 0),
        networkMrr: networkWon.reduce((sum, referral) => sum + referralMrr(referral), 0)
      };
    }).sort((a, b) => (b.directMrr + b.networkMrr) - (a.directMrr + a.networkMrr));
  }, [partners, referrals]);

  if (report.length === 0) return null;

  const directTotal = report.reduce((sum, item) => sum + item.directMrr, 0);
  const networkTotal = report.reduce((sum, item) => sum + item.networkMrr, 0);
  const associatedTotal = new Set(report.flatMap(item => item.associatedPartners.map(partner => partner.id))).size;

  return (
    <section className="bg-zry-surface rounded-zry-lg border border-zry-border/90 overflow-hidden">
      <div className="p-6 sm:p-7 border-b border-zry-border">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-zry-lilas-30 text-zry-roxo shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zry-text">Análise de Embaixadores</h2>
              <p className="text-xs text-zry-text-2 mt-1 max-w-2xl">
                MRR histórico dos negócios ganhos, separado entre clientes indicados pelo próprio
                embaixador e clientes trazidos pelos parceiros da sua rede. Cancelamentos continuam
                no histórico do que já foi gerado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 xl:min-w-[540px]">
            {[
              { label: 'Embaixadores', value: String(report.length), icon: Award },
              { label: 'Parceiros associados', value: String(associatedTotal), icon: Users },
              { label: 'MRR direto', value: money(directTotal), icon: TrendingUp },
              { label: 'MRR da rede', value: money(networkTotal), icon: Network }
            ].map(item => (
              <div key={item.label} className="rounded-xl bg-zry-lilas-30 px-3 py-2.5 min-w-0">
                <div className="flex items-center gap-1.5 text-zry-text-2">
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px] font-semibold truncate">{item.label}</span>
                </div>
                <p className="text-sm font-extrabold text-zry-text mt-1 truncate">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="divide-y divide-zry-border">
        {report.map(item => {
          const expanded = expandedId === item.id;
          const totalMrr = item.directMrr + item.networkMrr;
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="w-full p-5 sm:px-7 text-left hover:bg-zry-lilas-30/40 transition"
              >
                <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(100px,1fr))_24px] gap-3 md:items-center">
                  <div>
                    <p className="text-sm font-bold text-zry-text">{item.name}</p>
                    <p className="text-[11px] text-zry-text-2 mt-0.5">
                      {item.associatedPartners.length} parceiro(s) na rede
                    </p>
                  </div>
                  <Metric label="Clientes diretos" value={item.directWon.length.toString()} />
                  <Metric label="MRR direto" value={money(item.directMrr)} />
                  <Metric label="Clientes da rede" value={item.networkWon.length.toString()} />
                  <Metric label="MRR total gerado" value={money(totalMrr)} highlight />
                  {expanded
                    ? <ChevronUp className="w-4 h-4 text-zry-text-2" />
                    : <ChevronDown className="w-4 h-4 text-zry-text-2" />}
                </div>
              </button>

              {expanded && (
                <div className="bg-zry-lilas-30/35 px-5 sm:px-7 py-5 border-t border-zry-border">
                  <p className="text-xs font-bold text-zry-text mb-3">Parceiros associados e produção da rede</p>
                  {item.associatedPartners.length === 0 ? (
                    <p className="text-xs text-zry-text-2">Nenhum parceiro associado visível no seu escopo.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {item.associatedPartners.map(partner => {
                        const partnerWon = item.networkWon.filter(referral => referral.partnerId === partner.id);
                        const partnerMrr = partnerWon.reduce((sum, referral) => sum + referralMrr(referral), 0);
                        return (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() => onSelectPartner(partner.id)}
                            className="rounded-xl border border-zry-border bg-zry-surface p-3 text-left hover:border-zry-roxo/40 transition"
                          >
                            <p className="text-xs font-bold text-zry-text truncate">{partner.name}</p>
                            <p className="text-[10.5px] text-zry-text-2 mt-1">
                              {partnerWon.length} cliente(s) ganho(s) · {money(partnerMrr)} de MRR
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zry-text-2 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-extrabold mt-0.5 ${highlight ? 'text-zry-positive' : 'text-zry-text'}`}>
        {value}
      </p>
    </div>
  );
}
