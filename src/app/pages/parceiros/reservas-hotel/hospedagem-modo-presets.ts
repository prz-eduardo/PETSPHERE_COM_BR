import type { HotelUsoOperacao } from '../agenda/services/agenda-api.service';

/** Modo filtrado na API (`ambos` não é filtro de listagem). */
export type HospedagemModoFiltro = 'hospedagem' | 'daycare';

export interface HospedagemLeitoPreset {
  uso_operacao: HotelUsoOperacao;
  servicos_slugs: string[];
  acomodacao_slugs: string[];
  chk_in_hora: string;
  chk_out_hora: string;
  limite_estadia_dias: string;
}

export const HOSPEDAGEM_LEITO_PRESET_HOTEL: HospedagemLeitoPreset = {
  uso_operacao: 'hospedagem',
  servicos_slugs: ['hospedagem_noturna'],
  acomodacao_slugs: ['canil_individual'],
  chk_in_hora: '14:00',
  chk_out_hora: '12:00',
  limite_estadia_dias: '30',
};

export const HOSPEDAGEM_LEITO_PRESET_DAYCARE: HospedagemLeitoPreset = {
  uso_operacao: 'daycare',
  servicos_slugs: ['creche_diurna'],
  acomodacao_slugs: ['daycare_area'],
  chk_in_hora: '08:00',
  chk_out_hora: '18:00',
  limite_estadia_dias: '1',
};

/** Datas padrão para o formulário rápido (YYYY-MM-DD + horários ISO). */
export function defaultCheckInOutForModo(modo: HospedagemModoFiltro): {
  checkInDate: string;
  checkOutDate: string;
  checkInIso: string;
  checkOutIso: string;
} {
  const d0 = new Date();
  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  if (modo === 'daycare') {
    const a = ymd(d0);
    return {
      checkInDate: a,
      checkOutDate: a,
      checkInIso: `${a}T08:00:00`,
      checkOutIso: `${a}T18:00:00`,
    };
  }
  const d1 = new Date(d0);
  d1.setDate(d1.getDate() + 1);
  const ci = ymd(d0);
  const co = ymd(d1);
  return {
    checkInDate: ci,
    checkOutDate: co,
    checkInIso: `${ci}T14:00:00`,
    checkOutIso: `${co}T12:00:00`,
  };
}
