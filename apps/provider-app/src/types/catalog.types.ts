// Catalog & profile types for the provider-app

export type ServiceCategory =
  | 'PLOMERIA'
  | 'ELECTRICIDAD'
  | 'LIMPIEZA'
  | 'JARDINERIA'
  | 'PINTURA'
  | 'CLIMATIZACION'
  | 'OTROS';

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  LIMPIEZA: 'Limpieza',
  JARDINERIA: 'Jardinería',
  PINTURA: 'Pintura',
  CLIMATIZACION: 'Climatización',
  OTROS: 'Otros',
};

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

export interface CreateServicePayload {
  name: string;
  description?: string;
  price: number;
  category: ServiceCategory;
  imageUrl?: string;
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

export interface UpsertProfilePayload {
  fullName: string;
  role?: 'CLIENT' | 'PROVIDER' | 'ADMIN';
  bio?: string;
  photoUrl?: string;
  phone?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}
