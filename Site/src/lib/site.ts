// Single source of site-wide constants. The domain is a one-line change (research R2) —
// keep astro.config.mjs's `site` value in sync with SITE_ORIGIN below.
export const SITE_ORIGIN = 'https://tapevision.roilabs.com.br';

export const PRODUCT_NAME = 'Tape Vision AI';

export const ORG = {
  name: 'ROI Labs',
  url: 'https://roilabs.com.br',
  logo: `${SITE_ORIGIN}/og/logo.png`,
  sameAs: [] as string[],
};

export const CONSENT_VERSION = '2026-08-12';

export const NAV_LINKS = [
  { href: '/', label: 'Início' },
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/acesso', label: 'Acesso antecipado' },
] as const;
