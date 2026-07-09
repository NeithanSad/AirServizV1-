/**
 * Demo seed data — inserted on startup only when the profiles table is empty.
 *
 * Provider UUIDs are FIXED and shared with catalog-service's seed
 * (see catalog-service/src/services/seed/demo-catalog.seed.ts) so that
 * client-app dropdowns resolve consistently across services.
 *
 * Photos: free portrait URLs from randomuser.me (libre uso para demos).
 */

export const DEMO_PROFILES = [
  {
    userId: '3f8a2c4e-9b1d-4e6f-a2c8-5d7e9f0b1a2c',
    fullName: 'Mario Fontanería',
    role: 'PROVIDER' as const,
    bio: 'Plomero certificado con 10 años de experiencia en instalaciones residenciales.',
    photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    phone: '+52 555 123 4567',
    city: 'Ciudad de México',
    address: 'Av. Insurgentes Sur 1234, Col. Del Valle',
    latitude: 19.432608,
    longitude: -99.133209,
  },
  {
    userId: '7c2e5a8b-4d6f-4a1c-9e3b-8f0a2d4c6e1b',
    fullName: 'ElectricSA Servicios',
    role: 'PROVIDER' as const,
    bio: 'Electricistas e instaladores de climatización. Trabajo garantizado por escrito.',
    photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
    phone: '+52 555 987 6543',
    city: 'Guadalajara',
    address: 'Calle Morelos 567, Centro',
    latitude: 20.659698,
    longitude: -103.349609,
  },
  {
    userId: 'a9d4f7b2-1c3e-4b5a-8d6f-2e4a6c8b0d3f',
    fullName: 'CleanPro Hogar',
    role: 'PROVIDER' as const,
    bio: 'Limpieza profesional y mantenimiento de jardines para hogares y oficinas.',
    photoUrl: 'https://randomuser.me/api/portraits/men/67.jpg',
    phone: '+52 555 456 7890',
    city: 'Monterrey',
    address: 'Av. Constitución 890, Col. Obispado',
    latitude: 25.686613,
    longitude: -100.316116,
  },
];
