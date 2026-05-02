/**
 * Estilos de máscara para visitantes na galeria pública.
 * Definidos em TS para centralizar valores (o conteúdo real ainda chega ao browser — proteção forte exige API).
 */

export const GUEST_FEED_PHOTO_IMG_STYLE: Record<string, string> = {
  filter: 'blur(13px) saturate(0.78) brightness(0.9)',
  transform: 'scale(1.08)',
};

export const GUEST_FEED_PHOTO_VEIL_STYLE: Record<string, string> = {
  position: 'absolute',
  inset: '0',
  zIndex: '3',
  pointerEvents: 'none',
  background: 'linear-gradient(180deg, rgba(6, 10, 18, 0.14) 0%, rgba(6, 10, 18, 0.42) 100%)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
};

export const GUEST_FEED_FOOTER_STYLE: Record<string, string> = {
  filter: 'blur(10px) saturate(0.82)',
  opacity: '0.7',
};

export const GUEST_LIGHTBOX_IMG_STYLE: Record<string, string> = {
  filter: 'blur(18px) saturate(0.75) brightness(0.88)',
  transform: 'scale(1.07)',
};

export const GUEST_LIGHTBOX_MEDIA_VEIL_STYLE: Record<string, string> = {
  position: 'absolute',
  inset: '0',
  zIndex: '2',
  pointerEvents: 'none',
  background: 'linear-gradient(165deg, rgba(6, 10, 18, 0.18) 0%, rgba(6, 10, 18, 0.48) 100%)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
};

export const GUEST_LIGHTBOX_SIDE_INNER_STYLE: Record<string, string> = {
  filter: 'blur(11px) saturate(0.8)',
  opacity: '0.5',
  pointerEvents: 'none',
  userSelect: 'none',
};
