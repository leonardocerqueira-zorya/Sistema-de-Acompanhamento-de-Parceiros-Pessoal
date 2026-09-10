// Estados e municípios do Brasil para os seletores de Cidade/UF do parceiro.
//
// UF é uma lista fixa (só 27). Município não: são ~5.570, pesado demais pra
// embutir no bundle. Por isso vem sob demanda da API pública do IBGE, filtrada
// por UF (a mesma fonte já usada por bancos/ERPs brasileiros para essa lista),
// com cache em memória e localStorage — assim só baixa uma vez por estado,
// inclusive entre sessões, e continua funcionando offline depois da primeira vez.
export const BRAZIL_STATES: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' }
];

const CITIES_CACHE_PREFIX = 'zorya_ibge_cidades_v1_';
const memoryCache = new Map<string, string[]>();

/** Municípios de uma UF, em ordem alfabética. [] em UF inválida ou falha sem cache. */
export async function fetchCitiesByState(uf: string): Promise<string[]> {
  const key = uf.trim().toUpperCase();
  if (!key) return [];

  const cached = memoryCache.get(key);
  if (cached) return cached;

  const storageKey = CITIES_CACHE_PREFIX + key;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    /* cache ilegível: busca de novo */
  }

  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios`);
    if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
    const data = (await res.json()) as Array<{ nome: string }>;
    const names = data.map(m => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    memoryCache.set(key, names);
    try {
      localStorage.setItem(storageKey, JSON.stringify(names));
    } catch {
      /* sem espaço: segue só com o cache em memória desta sessão */
    }
    return names;
  } catch (e) {
    console.warn(`Não foi possível carregar os municípios de ${key} (IBGE indisponível):`, e);
    return [];
  }
}
