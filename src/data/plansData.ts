import { queueWrite, registerRowResolver, SETTING_PRICING_PLANS } from '../services/repository';
import { isTracking } from '../services/syncState';
export interface PricingPlan {
  id: string;
  commercialName: string;
  collaboratorsRange: string;
  label: string;
  monthlyPrice: number; // R$/mês
  annualFullPrice: number; // 12x - R$/ano
  annualCashPrice: number; // À vista -15%
  annual2xPrice: number; // Em 2x -10%
  annual2xInstallment: number; // parcela (2x de R$)
  annual3xPrice: number; // Em 3x -5%
  annual3xInstallment: number; // parcela (3x de R$)
  cashSavings: number; // Economia à vista
  commissionAmount: number; // Comissão fixa R$
  monthly10PercentDiscountPrice: number; // Planos 10% Desconto
}

export const ZORYA_PLANS: PricingPlan[] = [
  {
    id: 'starter_1_14',
    commercialName: 'Starter',
    collaboratorsRange: '01 a 14',
    label: 'Starter (01 a 14 colab.) — R$ 149,90/mês | Comis. R$ 300,00',
    monthlyPrice: 149.90,
    annualFullPrice: 1798.80,
    annualCashPrice: 1528.98,
    annual2xPrice: 1618.92,
    annual2xInstallment: 809.46,
    annual3xPrice: 1708.86,
    annual3xInstallment: 569.62,
    cashSavings: 269.82,
    commissionAmount: 300.00,
    monthly10PercentDiscountPrice: 134.91
  },
  {
    id: 'growth_15_30',
    commercialName: 'Growth',
    collaboratorsRange: '15 a 30',
    label: 'Growth (15 a 30 colab.) — R$ 269,90/mês | Comis. R$ 400,00',
    monthlyPrice: 269.90,
    annualFullPrice: 3238.80,
    annualCashPrice: 2752.98,
    annual2xPrice: 2914.92,
    annual2xInstallment: 1457.46,
    annual3xPrice: 3076.86,
    annual3xInstallment: 1025.62,
    cashSavings: 485.82,
    commissionAmount: 400.00,
    monthly10PercentDiscountPrice: 242.91
  },
  {
    id: 'business_31_50',
    commercialName: 'Business',
    collaboratorsRange: '31 a 50',
    label: 'Business (31 a 50 colab.) — R$ 449,90/mês | Comis. R$ 600,00',
    monthlyPrice: 449.90,
    annualFullPrice: 5398.80,
    annualCashPrice: 4588.98,
    annual2xPrice: 4858.92,
    annual2xInstallment: 2429.46,
    annual3xPrice: 5128.86,
    annual3xInstallment: 1709.62,
    cashSavings: 809.82,
    commissionAmount: 600.00,
    monthly10PercentDiscountPrice: 404.91
  },
  {
    id: 'enterprise_51_100',
    commercialName: 'Enterprise',
    collaboratorsRange: '51 a 100',
    label: 'Enterprise (51 a 100 colab.) — R$ 619,90/mês | Comis. R$ 800,00',
    monthlyPrice: 619.90,
    annualFullPrice: 7438.80,
    annualCashPrice: 6322.98,
    annual2xPrice: 6694.92,
    annual2xInstallment: 3347.46,
    annual3xPrice: 7066.86,
    annual3xInstallment: 2355.62,
    cashSavings: 1115.82,
    commissionAmount: 800.00,
    monthly10PercentDiscountPrice: 557.91
  },
  {
    id: 'scale_101_200',
    commercialName: 'Scale',
    collaboratorsRange: '101 a 200',
    label: 'Scale (101 a 200 colab.) — R$ 969,90/mês | Comis. R$ 1.200,00',
    monthlyPrice: 969.90,
    annualFullPrice: 11638.80,
    annualCashPrice: 9892.98,
    annual2xPrice: 10474.92,
    annual2xInstallment: 5237.46,
    annual3xPrice: 11056.86,
    annual3xInstallment: 3685.62,
    cashSavings: 1745.82,
    commissionAmount: 1200.00,
    monthly10PercentDiscountPrice: 872.91
  },
  {
    id: 'scale_201_300',
    commercialName: 'Scale',
    collaboratorsRange: '201 a 300',
    label: 'Scale (201 a 300 colab.) — R$ 1.079,90/mês | Comis. R$ 1.600,00',
    monthlyPrice: 1079.90,
    annualFullPrice: 12958.80,
    annualCashPrice: 11014.98,
    annual2xPrice: 11662.92,
    annual2xInstallment: 5831.46,
    annual3xPrice: 12310.86,
    annual3xInstallment: 4103.62,
    cashSavings: 1943.82,
    commissionAmount: 1600.00,
    monthly10PercentDiscountPrice: 971.91
  },
  {
    id: 'scale_301_400',
    commercialName: 'Scale',
    collaboratorsRange: '301 a 400',
    label: 'Scale (301 a 400 colab.) — R$ 1.289,90/mês | Comis. R$ 2.000,00',
    monthlyPrice: 1289.90,
    annualFullPrice: 15478.80,
    annualCashPrice: 13156.98,
    annual2xPrice: 13930.92,
    annual2xInstallment: 6965.46,
    annual3xPrice: 14704.86,
    annual3xInstallment: 4901.62,
    cashSavings: 2321.82,
    commissionAmount: 2000.00,
    monthly10PercentDiscountPrice: 1160.91
  },
  {
    id: 'scale_401_500',
    commercialName: 'Scale',
    collaboratorsRange: '401 a 500',
    label: 'Scale (401 a 500 colab.) — R$ 1.549,90/mês | Comis. R$ 2.400,00',
    monthlyPrice: 1549.90,
    annualFullPrice: 18598.80,
    annualCashPrice: 15808.98,
    annual2xPrice: 16738.92,
    annual2xInstallment: 8369.46,
    annual3xPrice: 17668.86,
    annual3xInstallment: 5889.62,
    cashSavings: 2789.82,
    commissionAmount: 2400.00,
    monthly10PercentDiscountPrice: 1394.91
  },
  {
    id: 'scale_501_600',
    commercialName: 'Scale',
    collaboratorsRange: '501 a 600',
    label: 'Scale (501 a 600 colab.) — R$ 2.019,90/mês | Comis. R$ 2.800,00',
    monthlyPrice: 2019.90,
    annualFullPrice: 24238.80,
    annualCashPrice: 20602.98,
    annual2xPrice: 21814.92,
    annual2xInstallment: 10907.46,
    annual3xPrice: 23026.86,
    annual3xInstallment: 7675.62,
    cashSavings: 3635.82,
    commissionAmount: 2800.00,
    monthly10PercentDiscountPrice: 1817.91
  },
  {
    id: 'scale_601_700',
    commercialName: 'Scale',
    collaboratorsRange: '601 a 700',
    label: 'Scale (601 a 700 colab.) — R$ 2.314,90/mês | Comis. R$ 3.200,00',
    monthlyPrice: 2314.90,
    annualFullPrice: 27778.80,
    annualCashPrice: 23611.98,
    annual2xPrice: 25000.92,
    annual2xInstallment: 12500.46,
    annual3xPrice: 26389.86,
    annual3xInstallment: 8796.62,
    cashSavings: 4166.82,
    commissionAmount: 3200.00,
    monthly10PercentDiscountPrice: 2083.41
  },
  {
    id: 'scale_701_800',
    commercialName: 'Scale',
    collaboratorsRange: '701 a 800',
    label: 'Scale (701 a 800 colab.) — R$ 2.609,90/mês | Comis. R$ 3.600,00',
    monthlyPrice: 2609.90,
    annualFullPrice: 31318.80,
    annualCashPrice: 26620.98,
    annual2xPrice: 28186.92,
    annual2xInstallment: 14093.46,
    annual3xPrice: 29752.86,
    annual3xInstallment: 9917.62,
    cashSavings: 4697.82,
    commissionAmount: 3600.00,
    monthly10PercentDiscountPrice: 2348.91
  },
  {
    id: 'scale_801_900',
    commercialName: 'Scale',
    collaboratorsRange: '801 a 900',
    label: 'Scale (801 a 900 colab.) — R$ 2.904,90/mês | Comis. R$ 4.000,00',
    monthlyPrice: 2904.90,
    annualFullPrice: 34858.80,
    annualCashPrice: 29629.98,
    annual2xPrice: 31372.92,
    annual2xInstallment: 15686.46,
    annual3xPrice: 33115.86,
    annual3xInstallment: 11038.62,
    cashSavings: 5228.82,
    commissionAmount: 4000.00,
    monthly10PercentDiscountPrice: 2614.41
  },
  {
    id: 'scale_901_1000',
    commercialName: 'Scale',
    collaboratorsRange: '901 a 1000',
    label: 'Scale (901 a 1000 colab.) — R$ 3.199,90/mês | Comis. R$ 4.400,00',
    monthlyPrice: 3199.90,
    annualFullPrice: 38398.80,
    annualCashPrice: 32638.98,
    annual2xPrice: 34558.92,
    annual2xInstallment: 17279.46,
    annual3xPrice: 36478.86,
    annual3xInstallment: 12159.62,
    cashSavings: 5759.82,
    commissionAmount: 4400.00,
    monthly10PercentDiscountPrice: 2879.91
  },
  {
    id: 'scale_1001_1500',
    commercialName: 'Scale',
    collaboratorsRange: '1001 a 1500',
    label: 'Scale (1001 a 1500 colab.) — R$ 3.759,90/mês | Comis. R$ 6.400,00',
    monthlyPrice: 3759.90,
    annualFullPrice: 45118.80,
    annualCashPrice: 38350.98,
    annual2xPrice: 40606.92,
    annual2xInstallment: 20303.46,
    annual3xPrice: 42862.86,
    annual3xInstallment: 14287.62,
    cashSavings: 6767.82,
    commissionAmount: 6400.00,
    monthly10PercentDiscountPrice: 3383.91
  },
  {
    id: 'scale_1501_2000',
    commercialName: 'Scale',
    collaboratorsRange: '1501 a 2000',
    label: 'Scale (1501 a 2000 colab.) — R$ 4.319,90/mês | Comis. R$ 8.400,00',
    monthlyPrice: 4319.90,
    annualFullPrice: 51838.80,
    annualCashPrice: 44062.98,
    annual2xPrice: 46654.92,
    annual2xInstallment: 23327.46,
    annual3xPrice: 49246.86,
    annual3xInstallment: 16415.62,
    cashSavings: 7775.82,
    commissionAmount: 8400.00,
    monthly10PercentDiscountPrice: 3887.91
  },
  {
    id: 'scale_2001_2500',
    commercialName: 'Scale',
    collaboratorsRange: '2001 a 2500',
    label: 'Scale (2001 a 2500 colab.) — R$ 5.354,90/mês | Comis. R$ 10.400,00',
    monthlyPrice: 5354.90,
    annualFullPrice: 64258.80,
    annualCashPrice: 54619.98,
    annual2xPrice: 57832.92,
    annual2xInstallment: 28916.46,
    annual3xPrice: 61045.86,
    annual3xInstallment: 20348.62,
    cashSavings: 9638.82,
    commissionAmount: 10400.00,
    monthly10PercentDiscountPrice: 4819.41
  },
  {
    id: 'scale_2501_3000',
    commercialName: 'Scale',
    collaboratorsRange: '2501 a 3000',
    label: 'Scale (2501 a 3000 colab.) — R$ 6.389,90/mês | Comis. R$ 12.400,00',
    monthlyPrice: 6389.90,
    annualFullPrice: 76678.80,
    annualCashPrice: 65176.98,
    annual2xPrice: 69010.92,
    annual2xInstallment: 34505.46,
    annual3xPrice: 72844.86,
    annual3xInstallment: 24281.62,
    cashSavings: 11501.82,
    commissionAmount: 12400.00,
    monthly10PercentDiscountPrice: 5750.91
  },
  {
    id: 'scale_3001_3500',
    commercialName: 'Scale',
    collaboratorsRange: '3001 a 3500',
    label: 'Scale (3001 a 3500 colab.) — R$ 7.027,90/mês | Comis. R$ 14.400,00',
    monthlyPrice: 7027.90,
    annualFullPrice: 84334.80,
    annualCashPrice: 71684.58,
    annual2xPrice: 75901.32,
    annual2xInstallment: 37950.66,
    annual3xPrice: 80118.06,
    annual3xInstallment: 26706.02,
    cashSavings: 12650.22,
    commissionAmount: 14400.00,
    monthly10PercentDiscountPrice: 6325.11
  },
  {
    id: 'scale_3501_4000',
    commercialName: 'Scale',
    collaboratorsRange: '3501 a 4000',
    label: 'Scale (3501 a 4000 colab.) — R$ 7.665,90/mês | Comis. R$ 16.400,00',
    monthlyPrice: 7665.90,
    annualFullPrice: 91990.80,
    annualCashPrice: 78192.18,
    annual2xPrice: 82791.72,
    annual2xInstallment: 41395.86,
    annual3xPrice: 87391.26,
    annual3xInstallment: 29130.42,
    cashSavings: 13798.62,
    commissionAmount: 16400.00,
    monthly10PercentDiscountPrice: 6899.31
  },
  {
    id: 'scale_4001_4500',
    commercialName: 'Scale',
    collaboratorsRange: '4001 a 4500',
    label: 'Scale (4001 a 4500 colab.) — R$ 8.432,90/mês | Comis. R$ 18.400,00',
    monthlyPrice: 8432.90,
    annualFullPrice: 101194.80,
    annualCashPrice: 86015.58,
    annual2xPrice: 91075.32,
    annual2xInstallment: 45537.66,
    annual3xPrice: 96135.06,
    annual3xInstallment: 32045.02,
    cashSavings: 15179.22,
    commissionAmount: 18400.00,
    monthly10PercentDiscountPrice: 7589.61
  },
  {
    id: 'scale_4501_5000',
    commercialName: 'Scale',
    collaboratorsRange: '4501 a 5000',
    label: 'Scale (4501 a 5000 colab.) — R$ 9.199,90/mês | Comis. R$ 20.400,00',
    monthlyPrice: 9199.90,
    annualFullPrice: 110398.80,
    annualCashPrice: 93838.98,
    annual2xPrice: 99358.92,
    annual2xInstallment: 49679.46,
    annual3xPrice: 104878.86,
    annual3xInstallment: 34959.62,
    cashSavings: 16559.82,
    commissionAmount: 20400.00,
    monthly10PercentDiscountPrice: 8279.91
  }
];

// Google Drive Official Links configured for Zorya Partnership Program
export const GOOGLE_DRIVE_CONFIG = {
  toPayFolder: {
    name: 'Comissões a Pagar (Aguardando Liquidação)',
    id: '1klQm0MFojDzNVfM9o2_5_gakQdqg8RNY',
    url: 'https://drive.google.com/drive/folders/1klQm0MFojDzNVfM9o2_5_gakQdqg8RNY?usp=drive_link'
  },
  paidFolder: {
    name: 'NFs Pagas (Quitações Realizadas)',
    id: '1SCBKoc7hEeyYUVEH8iFBYS4BjhEX_1oI',
    url: 'https://drive.google.com/drive/folders/1SCBKoc7hEeyYUVEH8iFBYS4BjhEX_1oI?usp=drive_link'
  },
  receiptsFolder: {
    name: 'Comprovantes de Pagamentos de Comissões',
    id: '1_Ze3ULZii_ZawVMM4J8Mvy1brBhFoEf0',
    url: 'https://drive.google.com/drive/folders/1_Ze3ULZii_ZawVMM4J8Mvy1brBhFoEf0?usp=drive_link'
  }
};

const PLANS_STORAGE_KEY = 'zorya_custom_pricing_plans_v1';

// Recalculate plan financial metrics based on monthly price & commission
export function recalculatePlanValues(
  idOrPlan: string | PricingPlan,
  commercialName?: string,
  collaboratorsRange?: string,
  monthlyPrice?: number,
  commissionAmount?: number
): PricingPlan {
  if (typeof idOrPlan === 'object') {
    const p = idOrPlan;
    return recalculatePlanValues(
      p.id,
      p.commercialName,
      p.collaboratorsRange,
      p.monthlyPrice,
      p.commissionAmount
    );
  }

  const id = idOrPlan;
  const cName = commercialName || '';
  const cRange = collaboratorsRange || '';
  const mPrice = monthlyPrice || 0;
  const cAmount = commissionAmount || 0;

  const annualFullPrice = Math.round(mPrice * 12 * 100) / 100;
  const annualCashPrice = Math.round(annualFullPrice * 0.85 * 100) / 100;
  const annual2xPrice = Math.round(annualFullPrice * 0.90 * 100) / 100;
  const annual2xInstallment = Math.round((annual2xPrice / 2) * 100) / 100;
  const annual3xPrice = Math.round(annualFullPrice * 0.95 * 100) / 100;
  const annual3xInstallment = Math.round((annual3xPrice / 3) * 100) / 100;
  const cashSavings = Math.round((annualFullPrice - annualCashPrice) * 100) / 100;
  const monthly10PercentDiscountPrice = Math.round(mPrice * 0.90 * 100) / 100;

  const formattedMonthly = mPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedComm = cAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const label = `${cName} (${cRange} colab.) — R$ ${formattedMonthly}/mês | Comis. R$ ${formattedComm}`;

  return {
    id,
    commercialName: cName,
    collaboratorsRange: cRange,
    label,
    monthlyPrice: mPrice,
    annualFullPrice,
    annualCashPrice,
    annual2xPrice,
    annual2xInstallment,
    annual3xPrice,
    annual3xInstallment,
    cashSavings,
    commissionAmount: cAmount,
    monthly10PercentDiscountPrice
  };
}

// Load customized pricing plans from storage with fallback to ZORYA_PLANS
export function loadStoredPricingPlans(): PricingPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler tabela de planos do localStorage', e);
  }
  return ZORYA_PLANS;
}

// Save customized plans to storage
export function saveStoredPricingPlans(plans: PricingPlan[]): void {
  try {
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error('Erro ao salvar tabela de planos no localStorage', e);
  }
  // A tabela de planos vale para o time todo: antes ficava só no navegador de
  // quem editou.
  if (isTracking()) queueWrite('app_settings', SETTING_PRICING_PLANS, 'upsert');
}

// Reset plans to default official table
export function resetStoredPricingPlans(): PricingPlan[] {
  try {
    localStorage.removeItem(PLANS_STORAGE_KEY);
  } catch (e) {
    console.error('Erro ao restaurar planos padrão', e);
  }
  // Volta ao padrão para todo mundo, não só neste navegador.
  if (isTracking()) queueWrite('app_settings', SETTING_PRICING_PLANS, 'upsert');
  return ZORYA_PLANS;
}

registerRowResolver('app_settings', id =>
  id === SETTING_PRICING_PLANS ? { key: id, value: loadStoredPricingPlans() } : null
);
