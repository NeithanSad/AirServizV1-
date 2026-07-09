/**
 * Demo seed data — inserted on startup only when the services table is empty.
 *
 * Provider UUIDs are FIXED and shared with user-service's profile seed
 * (see user-service/src/profiles/seed/demo-profiles.seed.ts) so that the
 * client-app dropdowns resolve consistently across services.
 */

export const DEMO_PROVIDER_IDS = {
  MARIO_FONTANERIA: '3f8a2c4e-9b1d-4e6f-a2c8-5d7e9f0b1a2c',
  ELECTRICSA: '7c2e5a8b-4d6f-4a1c-9e3b-8f0a2d4c6e1b',
  CLEANPRO: 'a9d4f7b2-1c3e-4b5a-8d6f-2e4a6c8b0d3f',
} as const;

export const DEMO_SERVICES = [
  {
    providerId: DEMO_PROVIDER_IDS.MARIO_FONTANERIA,
    name: 'Reparación de fugas de agua',
    description: 'Detección y reparación de fugas en cocina, baño y tuberías generales.',
    price: 150.0,
    category: 'PLOMERIA' as const,
    imageUrl: 'https://picsum.photos/seed/plumbing/400/300',
  },
  {
    providerId: DEMO_PROVIDER_IDS.MARIO_FONTANERIA,
    name: 'Instalación de calentador de agua',
    description: 'Instalación y puesta en marcha de calentadores eléctricos o de gas.',
    price: 220.0,
    category: 'PLOMERIA' as const,
    imageUrl: 'https://picsum.photos/seed/waterheater/400/300',
  },
  {
    providerId: DEMO_PROVIDER_IDS.ELECTRICSA,
    name: 'Revisión de instalación eléctrica',
    description: 'Diagnóstico completo del tablero y circuitos del hogar.',
    price: 120.0,
    category: 'ELECTRICIDAD' as const,
    imageUrl: 'https://picsum.photos/seed/electric/400/300',
  },
  {
    providerId: DEMO_PROVIDER_IDS.ELECTRICSA,
    name: 'Instalación de aire acondicionado',
    description: 'Montaje e instalación de equipos mini-split hasta 24,000 BTU.',
    price: 300.0,
    category: 'CLIMATIZACION' as const,
    imageUrl: 'https://picsum.photos/seed/aircon/400/300',
  },
  {
    providerId: DEMO_PROVIDER_IDS.CLEANPRO,
    name: 'Limpieza profunda de hogar',
    description: 'Limpieza completa de hasta 3 habitaciones, cocina y baños.',
    price: 90.0,
    category: 'LIMPIEZA' as const,
    imageUrl: 'https://picsum.photos/seed/cleaning/400/300',
  },
  {
    providerId: DEMO_PROVIDER_IDS.CLEANPRO,
    name: 'Mantenimiento de jardín',
    description: 'Poda, corte de césped y limpieza de áreas verdes.',
    price: 75.0,
    category: 'JARDINERIA' as const,
    imageUrl: 'https://picsum.photos/seed/garden/400/300',
  },
];
