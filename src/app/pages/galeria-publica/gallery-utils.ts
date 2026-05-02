import type { PostDto, PostEngagement, PostImagem, PostPetResumo } from '../../services/api.service';

/** Item normalizado consumido pelo grid e pelo lightbox. */
export interface FeedPostItem {
  type: 'post';
  id: number;
  pet_id: number;
  pet?: PostPetResumo | null;
  pets: PostPetResumo[];
  tutor?: { nome?: string | null; foto?: string | null } | null;
  caption: string;
  cover_imagem_id: number | null;
  galeria_publica: boolean;
  ativo: boolean;
  created_at: string | null;
  imagens: PostImagem[];
  engagement: Required<Pick<PostEngagement, 'love' | 'haha' | 'sad' | 'angry' | 'total' | 'comentarios'>> & {
    minha_reacao: { tipo: string } | null;
  };
  /** URLs prontas para uso (resolvidas + dedupadas). */
  galeria_urls: string[];
  /** Cover URL pronto. */
  cover_url: string | null;
}

export interface FeedAdItem {
  type: 'vet_ad';
  vet_id?: number;
  nome?: string;
  foto?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  promo_text?: string | null;
  [key: string]: any;
}

export type FeedItem = FeedPostItem | FeedAdItem;

const REACTION_DEFAULTS = { love: 0, haha: 0, sad: 0, angry: 0, total: 0, comentarios: 0 } as const;

/** Tira espaços, valida e devolve string ou null. */
function safeStr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s ? s : null;
}

/** Normaliza um post vindo do backend para um `FeedPostItem`. */
export function normalizePost(raw: any): FeedPostItem {
  const imgList = Array.isArray(raw?.imagens)
    ? raw.imagens
    : Array.isArray(raw?.images)
      ? raw.images
      : [];
  const imagens: PostImagem[] = imgList
    .map((img: any) => ({
      id: Number(img?.id ?? 0),
      url: typeof img?.url === 'string' ? img.url.trim() : '',
      ordem: img?.ordem != null ? Number(img.ordem) : null,
    }))
    .filter((img: PostImagem) => img.id > 0 && !!img.url);

  const engagementRaw: PostEngagement = raw?.engagement && typeof raw.engagement === 'object' ? raw.engagement : {};
  const mineTipo =
    engagementRaw.minha_reacao && typeof engagementRaw.minha_reacao === 'object'
      ? String(engagementRaw.minha_reacao.tipo || '').toLowerCase()
      : raw?.mine?.reaction
        ? String(raw.mine.reaction).toLowerCase()
        : '';
  const engagement = {
    love: Number(engagementRaw.love ?? raw?.love ?? 0) || 0,
    haha: Number(engagementRaw.haha ?? raw?.haha ?? 0) || 0,
    sad: Number(engagementRaw.sad ?? raw?.sad ?? 0) || 0,
    angry: Number(engagementRaw.angry ?? raw?.angry ?? 0) || 0,
    total: Number(engagementRaw.total ?? raw?.total ?? 0) || 0,
    comentarios:
      Number(
        engagementRaw.comentarios ??
          raw?.comentarios ??
          (raw?.counts && raw.counts.comments != null ? raw.counts.comments : 0)
      ) || 0,
    minha_reacao: mineTipo ? { tipo: mineTipo } : null,
  };

  if (!engagement.total) {
    engagement.total = engagement.love + engagement.haha + engagement.sad + engagement.angry;
  }
  if (!engagement.total && raw?.counts && raw.counts.reactions != null) {
    engagement.total = Number(raw.counts.reactions) || 0;
  }

  const cover = imagens.find((img) => img.id === Number(raw?.cover_imagem_id)) || imagens[0] || null;
  const cover_url = cover ? cover.url : null;
  const galeria_urls = imagens.map((img) => img.url);

  const mapPet = (p: any): PostPetResumo => ({
    id: Number(p?.id ?? 0),
    nome: p?.nome ?? null,
    especie: p?.especie ?? null,
    raca: p?.raca ?? null,
    foto: p?.foto ?? p?.photoURL ?? null,
  });

  const tagged = Array.isArray(raw?.tagged_pets) ? raw.tagged_pets.map(mapPet) : [];
  const legacyPets = Array.isArray(raw?.pets) ? raw.pets.map(mapPet) : [];
  const pets = tagged.length ? tagged : legacyPets;

  return {
    type: 'post',
    id: Number(raw?.id ?? 0),
    pet_id: Number(raw?.pet_id ?? raw?.pet?.id ?? 0),
    pet: raw?.pet
      ? {
          id: Number(raw.pet.id ?? 0),
          nome: raw.pet.nome ?? null,
          especie: raw.pet.especie ?? null,
          raca: raw.pet.raca ?? null,
          foto: raw.pet.foto ?? raw.pet.photoURL ?? null,
        }
      : null,
    tutor: raw?.tutor
      ? {
          nome: raw.tutor.nome ?? null,
          foto: raw.tutor.foto ?? null,
        }
      : null,
    pets,
    caption: typeof raw?.caption === 'string' ? raw.caption : '',
    cover_imagem_id: cover ? cover.id : null,
    galeria_publica: !!(raw?.galeria_publica ?? 1),
    ativo: !!(raw?.ativo ?? 1),
    created_at: safeStr(raw?.created_at),
    imagens,
    engagement,
    galeria_urls,
    cover_url,
  };
}

/** Normaliza um anúncio de vet vindo do backend (mantém shape). */
export function normalizeAd(raw: any): FeedAdItem {
  if (!raw || typeof raw !== 'object') {
    return { type: 'vet_ad' } as FeedAdItem;
  }
  return { ...raw, type: 'vet_ad' } as FeedAdItem;
}

/** Iniciais para avatar fallback. */
export function petInitials(nome?: string | null): string {
  const base = String(nome || 'Pet').trim();
  if (!base) return 'P';
  const parts = base.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
}

/** Emoji curto para o tipo de pet. */
export function typeEmoji(especie?: string | null): string {
  const v = String(especie || '').toLowerCase();
  if (!v) return 'PET';
  if (v.includes('cao') || v.includes('cão') || v.includes('dog')) return '🐶';
  if (v.includes('gato') || v.includes('cat')) return '🐱';
  if (v.includes('coelho')) return '🐰';
  if (v.includes('passaro') || v.includes('pássaro') || v.includes('bird')) return '🐦';
  if (v.includes('peixe') || v.includes('fish')) return '🐟';
  return '🐾';
}

/** Retorna `true` se o pet tem opt-in para a galeria pública. */
export function isPublicFeedEligible(pet: any): boolean {
  if (!pet) return false;
  const flag =
    pet.exibir_galeria_publica ??
    pet.galeria_publica ??
    pet.exibir_galeria;
  return flag === 1 || flag === '1' || flag === true || String(flag).toLowerCase() === 'true';
}

/** Retorna o "default" de engagement (zero-state). */
export function emptyEngagement(): FeedPostItem['engagement'] {
  return { ...REACTION_DEFAULTS, minha_reacao: null };
}
