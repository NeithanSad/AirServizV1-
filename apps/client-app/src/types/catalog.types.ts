// Catalog & profile types consumed by the client-app dropdowns

export type ServiceCategory =
  | 'PLOMERIA'
  | 'ELECTRICIDAD'
  | 'LIMPIEZA'
  | 'JARDINERIA'
  | 'PINTURA'
  | 'CLIMATIZACION'
  | 'OTROS';

export interface ServiceOffering {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  price: number;
  category: ServiceCategory;
  imageUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface ProviderProfile {
  userId: string;
  fullName: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
  bio?: string;
  photoUrl?: string;
  phone?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  LIMPIEZA: 'Limpieza',
  JARDINERIA: 'Jardinería',
  PINTURA: 'Pintura',
  CLIMATIZACION: 'Climatización',
  OTROS: 'Otros',
};
