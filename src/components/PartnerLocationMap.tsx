import { useMemo, useState } from 'react';
import type { Partner } from '../types';
import { MapPin, Info } from 'lucide-react';

interface PartnerLocationMapProps {
  partners: Partner[];
}

// Coordenadas aproximadas da capital de cada UF — usadas como centróide do
// estado pra plotar um mapa de bolhas (proporcional-symbol map), já que não
// temos lat/long por parceiro, só cidade/UF.
const STATE_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  AC: { lat: -9.97, lon: -67.81, name: 'Acre' },
  AL: { lat: -9.65, lon: -35.71, name: 'Alagoas' },
  AP: { lat: 0.03, lon: -51.07, name: 'Amapá' },
  AM: { lat: -3.10, lon: -60.02, name: 'Amazonas' },
  BA: { lat: -12.97, lon: -38.51, name: 'Bahia' },
  CE: { lat: -3.73, lon: -38.54, name: 'Ceará' },
  DF: { lat: -15.78, lon: -47.93, name: 'Distrito Federal' },
  ES: { lat: -20.32, lon: -40.34, name: 'Espírito Santo' },
  GO: { lat: -16.68, lon: -49.25, name: 'Goiás' },
  MA: { lat: -2.53, lon: -44.30, name: 'Maranhão' },
  MT: { lat: -15.60, lon: -56.10, name: 'Mato Grosso' },
  MS: { lat: -20.44, lon: -54.65, name: 'Mato Grosso do Sul' },
  MG: { lat: -19.92, lon: -43.94, name: 'Minas Gerais' },
  PA: { lat: -1.46, lon: -48.50, name: 'Pará' },
  PB: { lat: -7.12, lon: -34.86, name: 'Paraíba' },
  PR: { lat: -25.43, lon: -49.27, name: 'Paraná' },
  PE: { lat: -8.05, lon: -34.90, name: 'Pernambuco' },
  PI: { lat: -5.09, lon: -42.80, name: 'Piauí' },
  RJ: { lat: -22.91, lon: -43.17, name: 'Rio de Janeiro' },
  RN: { lat: -5.79, lon: -35.21, name: 'Rio Grande do Norte' },
  RS: { lat: -30.03, lon: -51.23, name: 'Rio Grande do Sul' },
  RO: { lat: -8.76, lon: -63.90, name: 'Rondônia' },
  RR: { lat: 2.82, lon: -60.67, name: 'Roraima' },
  SC: { lat: -27.60, lon: -48.55, name: 'Santa Catarina' },
  SP: { lat: -23.55, lon: -46.63, name: 'São Paulo' },
  SE: { lat: -10.91, lon: -37.07, name: 'Sergipe' },
  TO: { lat: -10.25, lon: -48.32, name: 'Tocantins' }
};

const WIDTH = 420;
const HEIGHT = 440;
const PADDING = 36;

export default function PartnerLocationMap({ partners }: PartnerLocationMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { stateCounts, cityCounts, totalWithLocation, totalWithoutLocation } = useMemo(() => {
    const byState = new Map<string, number>();
    const byCity = new Map<string, number>();
    let withLocation = 0;
    let withoutLocation = 0;

    partners.forEach(p => {
      const uf = (p.state || '').trim().toUpperCase();
      if (uf && STATE_COORDS[uf]) {
        byState.set(uf, (byState.get(uf) || 0) + 1);
        withLocation++;
      } else {
        withoutLocation++;
      }
      if (p.city) {
        const key = `${p.city.trim()}${uf ? ` - ${uf}` : ''}`;
        byCity.set(key, (byCity.get(key) || 0) + 1);
      }
    });

    return {
      stateCounts: byState,
      cityCounts: Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6),
      totalWithLocation: withLocation,
      totalWithoutLocation: withoutLocation
    };
  }, [partners]);

  const bubbles = useMemo(() => {
    const entries = Array.from(stateCounts.entries());
    if (entries.length === 0) return [];

    const lats = Object.values(STATE_COORDS).map(c => c.lat);
    const lons = Object.values(STATE_COORDS).map(c => c.lon);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);
    const maxCount = Math.max(...entries.map(([, c]) => c));

    const project = (lat: number, lon: number) => ({
      x: PADDING + ((lon - lonMin) / (lonMax - lonMin || 1)) * (WIDTH - PADDING * 2),
      y: PADDING + ((latMax - lat) / (latMax - latMin || 1)) * (HEIGHT - PADDING * 2)
    });

    const minR = 8;
    const maxR = 34;

    return entries.map(([uf, count]) => {
      const coords = STATE_COORDS[uf];
      const { x, y } = project(coords.lat, coords.lon);
      const r = minR + Math.sqrt(count / maxCount) * (maxR - minR);
      return { uf, name: coords.name, count, x, y, r };
    });
  }, [stateCounts]);

  if (totalWithLocation === 0) {
    return (
      <div className="bg-zry-surface rounded-zry-lg p-6 border border-zry-border">
        <div className="flex items-center gap-2 mb-3">
          <span className="p-1.5 bg-zry-lilas-30 text-zry-roxo rounded-lg">
            <MapPin className="w-4 h-4" />
          </span>
          <h3 className="text-base font-bold text-zry-text">Distribuição Geográfica dos Parceiros</h3>
        </div>
        <p className="text-xs text-zry-text-2">
          Nenhum parceiro com cidade/UF cadastrada ainda. Preencha esses campos no cadastro do parceiro
          (ou importe via planilha) para ver o mapa de distribuição.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zry-surface rounded-zry-lg p-6 border border-zry-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-zry-lilas-30 text-zry-roxo rounded-lg">
            <MapPin className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-base font-bold text-zry-text">Distribuição Geográfica dos Parceiros</h3>
            <p className="text-[11px] text-zry-text-2">
              {totalWithLocation} parceiro(s) com localização{totalWithoutLocation > 0 ? ` · ${totalWithoutLocation} sem cidade/UF cadastrada` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        {/* Bubble map */}
        <div className="bg-zry-lilas-30 rounded-2xl border border-zry-border flex items-center justify-center py-2">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-[420px]" role="img" aria-label="Mapa de bolhas do Brasil por estado com número de parceiros">
            {bubbles.map(b => {
              const isHovered = hovered === b.uf;
              return (
                <g
                  key={b.uf}
                  onMouseEnter={() => setHovered(b.uf)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={b.r}
                    className={isHovered ? 'fill-zry-coral' : 'fill-zry-roxo/85'}
                    stroke="white"
                    strokeWidth={1.5}
                  >
                    <title>{`${b.name} (${b.uf}): ${b.count} parceiro(s)`}</title>
                  </circle>
                  <text
                    x={b.x}
                    y={b.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={isHovered ? "fill-zry-roxo font-bold pointer-events-none select-none" : "fill-white font-bold pointer-events-none select-none"}
                    style={{ fontSize: b.r > 16 ? 11 : 9 }}
                  >
                    {b.uf}
                  </text>
                  {b.r > 14 && (
                    <text
                      x={b.x}
                      y={b.y + b.r + 12}
                      textAnchor="middle"
                      className="fill-zry-text-2 pointer-events-none select-none"
                      style={{ fontSize: 9, fontWeight: 700 }}
                    >
                      {b.count}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Ranking lateral */}
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-bold text-zry-text-2 uppercase tracking-wider block mb-2">
              Estados com Mais Parceiros
            </span>
            <div className="space-y-1.5">
              {Array.from(stateCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([uf, count]) => (
                  <div
                    key={uf}
                    onMouseEnter={() => setHovered(uf)}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition ${
                      hovered === uf ? 'bg-zry-lilas-30 text-zry-roxo' : 'text-zry-text-2'
                    }`}
                  >
                    <span className="font-semibold">{STATE_COORDS[uf]?.name || uf}</span>
                    <span className="font-bold bg-zry-lilas-30 px-1.5 py-0.5 rounded-full text-[11px]">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {cityCounts.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-zry-text-2 uppercase tracking-wider block mb-2">
                Cidades com Mais Parceiros
              </span>
              <div className="space-y-1.5">
                {cityCounts.map(([city, count]) => (
                  <div key={city} className="flex items-center justify-between text-xs px-2.5 py-1.5 text-zry-text-2">
                    <span className="truncate pr-2">{city}</span>
                    <span className="font-bold bg-zry-lilas-30 px-1.5 py-0.5 rounded-full text-[11px] shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {totalWithoutLocation > 0 && (
        <div className="mt-4 bg-zry-warning-bg/70 border border-zry-warning/30 rounded-xl p-2.5 text-[11px] text-zry-warning flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-zry-warning shrink-0 mt-0.5" />
          <span>{totalWithoutLocation} parceiro(s) sem cidade/UF preenchida não aparecem no mapa.</span>
        </div>
      )}
    </div>
  );
}
