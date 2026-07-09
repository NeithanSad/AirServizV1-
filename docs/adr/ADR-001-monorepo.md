# ADR-001: Monorepo híbrido para Sprint 0-2

## Estado
Aceptado

## Contexto
Ecosistema de 3 apps + 7 microservicios en fase inicial de validación, equipo pequeño.

## Decisión
Se adopta monorepo (carpetas apps/, services/, libs/) con CI/CD basado en path-triggers
por servicio. Se evaluará migración a polyrepo cuando existan equipos dedicados por servicio.

## Consecuencias
+ Contratos de eventos compartidos sin versionado de paquetes privados
+ Onboarding más simple
- Requiere disciplina en CI para no romper builds cruzados
