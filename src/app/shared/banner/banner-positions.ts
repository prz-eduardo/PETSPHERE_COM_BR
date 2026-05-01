export type BannerPosition =
  | 'home_hero'
  | 'loja_hero'
  | 'loja_inline'
  | 'categoria'
  | 'checkout'
  | 'carrinho'
  | 'galeria'
  | 'mapa'
  | 'produto';

export interface BannerPositionOption {
  value: BannerPosition;
  label: string;
  description: string;
  desktopRatio: number;
  mobileRatio: number;
}

/**
 * Catálogo único das posições onde banners podem ser exibidos no app.
 * Usado pelo admin (select/filter) e pelo componente público `app-banner-slot`.
 * As razões de aspecto servem de referência para o editor de imagem —
 * o backend não impõe esses valores, são sugestões visuais.
 */
export const BANNER_POSITIONS: BannerPositionOption[] = [
  { value: 'home_hero',   label: 'Home — Hero',            description: 'Faixa principal da página inicial', desktopRatio: 16 / 5, mobileRatio: 4 / 5 },
  { value: 'loja_hero',   label: 'Loja — Hero',            description: 'Topo da loja — faixa fixa 16:9 em todos os dispositivos', desktopRatio: 16 / 9, mobileRatio: 16 / 9 },
  { value: 'loja_inline', label: 'Loja — Entre produtos',  description: 'Cartão intercalado no grid da loja', desktopRatio: 16 / 5, mobileRatio: 16 / 5 },
  { value: 'categoria',   label: 'Página de Categoria',    description: 'Topo das páginas por categoria',    desktopRatio: 16 / 5, mobileRatio: 16 / 5 },
  { value: 'checkout',    label: 'Checkout',               description: 'Mensagem/aviso no processo de compra', desktopRatio: 16 / 3, mobileRatio: 3 / 2 },
  { value: 'carrinho',    label: 'Carrinho',               description: 'Dentro da página do carrinho',      desktopRatio: 16 / 3, mobileRatio: 3 / 2 },
  { value: 'galeria',     label: 'Galeria pública',        description: 'Área da galeria de fotos de pets',  desktopRatio: 16 / 5, mobileRatio: 4 / 5 },
  { value: 'mapa',        label: 'Mapa',                   description: 'Página de parceiros/mapa',          desktopRatio: 16 / 5, mobileRatio: 4 / 5 },
  { value: 'produto',     label: 'Página do produto',     description: 'Topo da ficha pública do produto',  desktopRatio: 16 / 5, mobileRatio: 4 / 5 },
];

export function getBannerPosition(value: string | null | undefined): BannerPositionOption | null {
  if (!value) return null;
  return BANNER_POSITIONS.find(p => p.value === value) || null;
}

export function bannerPositionLabel(value: string | null | undefined): string {
  const p = getBannerPosition(value);
  return p ? p.label : (value || '—');
}
