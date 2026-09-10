import type { EngagementLevel } from '../utils/partnerEngagement';
import { ENGAGEMENT_RISK_THRESHOLD } from '../utils/partnerEngagement';

interface EngagementBarProps {
  score: number | null;
  level: EngagementLevel;
  /** Mostra o número e o rótulo acima da barra. */
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const LEVEL_LABEL: Record<EngagementLevel, string> = {
  saudavel: 'Saudável',
  risco: 'Em risco',
  inativo: 'Inativo',
  'sem-dados': 'Sem data de entrada'
};

const LEVEL_FILL: Record<EngagementLevel, string> = {
  saudavel: 'bg-zry-positive',
  risco: 'bg-zry-warning',
  inativo: 'bg-zry-danger',
  'sem-dados': 'bg-zry-border-strong'
};

const LEVEL_TEXT: Record<EngagementLevel, string> = {
  saudavel: 'text-zry-positive',
  risco: 'text-zry-warning',
  inativo: 'text-zry-danger',
  'sem-dados': 'text-zry-text-2'
};

export default function EngagementBar({
  score,
  level,
  showLabel = true,
  size = 'md'
}: EngagementBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';
  const width = score === null ? 0 : Math.max(score > 0 ? 2 : 0, score); // 2% mínimo para a cor aparecer

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-[11px] font-bold ${LEVEL_TEXT[level]}`}>
            {score === null ? '—' : `${Math.round(score)}%`}
          </span>
          <span className="text-[10.5px] font-semibold text-zry-text-2">{LEVEL_LABEL[level]}</span>
        </div>
      )}

      <div
        className={`relative w-full ${height} bg-zry-lilas-30 rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={score ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Engajamento: ${score === null ? 'sem dados' : Math.round(score) + '%'} — ${LEVEL_LABEL[level]}`}
      >
        <div
          className={`h-full ${LEVEL_FILL[level]} rounded-full transition-all duration-500`}
          style={{ width: `${width}%` }}
        />
        {/* Marca do limiar de risco, para a barra se explicar sozinha. */}
        {score !== null && (
          <span
            className="absolute top-0 bottom-0 w-px bg-zry-roxo/25"
            style={{ left: `${ENGAGEMENT_RISK_THRESHOLD}%` }}
            title={`Limiar de risco: ${ENGAGEMENT_RISK_THRESHOLD}%`}
          />
        )}
      </div>
    </div>
  );
}
