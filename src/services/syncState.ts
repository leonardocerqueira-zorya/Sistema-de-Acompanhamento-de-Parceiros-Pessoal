// ---------------------------------------------------------------------------
// Estado de sincronização — módulo folha (sem imports) para que tanto
// storageService quanto channelMetricsService possam marcar alterações locais
// sem criar import circular com o syncService.
//
// O timestamp guardado aqui é o que permite ao merge decidir qual lado está
// mais fresco quando este navegador e a nuvem divergem.
// ---------------------------------------------------------------------------

const LOCAL_CHANGE_KEY = 'canal_alterado_localmente_em';
const PUSH_DEBOUNCE_MS = 1500;

type PushFn = () => Promise<void>;

let pushFn: PushFn | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let tracking = true;

// storageService registra aqui o push real pra nuvem no carregamento do módulo.
export function registerCloudPush(fn: PushFn): void {
  pushFn = fn;
}

export function getLocalChangeAt(): string | null {
  try {
    return localStorage.getItem(LOCAL_CHANGE_KEY);
  } catch {
    return null;
  }
}

export function setLocalChangeAt(iso: string): void {
  try {
    localStorage.setItem(LOCAL_CHANGE_KEY, iso);
  } catch {
    /* localStorage indisponível: sync cai no modo "sem timestamp", ainda seguro */
  }
}

// Chamado por todo save local de dado de negócio: registra o momento da
// alteração e agenda o espelhamento na nuvem.
export function markLocalChange(): void {
  if (!tracking) return;
  setLocalChangeAt(new Date().toISOString());
  if (!pushFn) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushFn?.().catch(e => console.warn('Sync com a nuvem falhou (dados seguem salvos localmente):', e));
  }, PUSH_DEBOUNCE_MS);
}

// Gravações feitas pelo próprio merge são eco da nuvem, não alteração do
// usuário: marcar timestamp aqui falsearia a recência e dispararia push
// redundante, então o rastreio é suspenso durante a aplicação do merge.
// Falso enquanto uma gravação é eco do servidor: quem escreve consulta isso
// para não reenviar de volta o que acabou de baixar.
export function isTracking(): boolean {
  return tracking;
}

export function runWithoutTracking<T>(fn: () => T): T {
  const previous = tracking;
  tracking = false;
  try {
    return fn();
  } finally {
    tracking = previous;
  }
}
