# AirServiz en Kubernetes (cluster local)

Manifiestos para desplegar AirServiz en un cluster local (kind, minikube o
Docker Desktop con Kubernetes activado).

## Estructura

```
infra/k8s/
  00-namespace.yaml      # namespace airserviz
  01-config.yaml         # ConfigMap + Secret (valores demo)
  infra/                 # Postgres x4, Kafka+Zookeeper, Redis, Kong
  services/              # 6 microservicios: Deployment + Service + HPA
  apps/                  # client-app y provider-app (nginx, NodePort)
```

## Requisitos

1. **kubectl** y un cluster local corriendo (`kubectl get nodes`).
2. **metrics-server** — necesario para que los HPA funcionen:
   - minikube: `minikube addons enable metrics-server`
   - kind / Docker Desktop: `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`
     (en kind/Docker Desktop añade `--kubelet-insecure-tls` al deployment de metrics-server).
3. **Imágenes**: se publican en `ghcr.io/neithansad/airserviz-*` vía el workflow
   `docker-publish.yml` al hacer push a `main`. Para un cluster local sin acceso
   a ghcr, constrúyelas y cárgalas:
   - kind: `kind load docker-image ghcr.io/neithansad/airserviz-auth-service:latest`
   - minikube: `minikube image load ghcr.io/neithansad/airserviz-auth-service:latest`

   `imagePullPolicy: IfNotPresent` hace que use la imagen local si ya está cargada.

## Desplegar

```bash
kubectl apply -f infra/k8s/00-namespace.yaml
kubectl apply -f infra/k8s/01-config.yaml
kubectl apply -f infra/k8s/infra/
kubectl apply -f infra/k8s/services/
kubectl apply -f infra/k8s/apps/
```

Verifica:

```bash
kubectl -n airserviz get pods,svc,hpa
```

## Acceso

- API gateway (Kong): `http://localhost:30080/api/...`
- client-app:  `http://localhost:30081`
- provider-app: `http://localhost:30082`

## Notas

- El **Secret** (`01-config.yaml`) lleva placeholders inválidos a propósito
  (`REPLACE_ME`): aplicarlo tal cual NO levanta un gateway funcional, porque el
  initContainer que renderiza la config de Kong exige un `JWT_SECRET` de 32+
  caracteres y aborta si no lo tiene. Es fail-closed deliberado. Crea el Secret
  real fuera de git y NUNCA lo commitees:

  ```bash
  kubectl create secret generic airserviz-secrets -n airserviz \
    --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
    --from-literal=DB_PASSWORD="$(openssl rand -hex 32)" \
    --from-literal=STRIPE_WEBHOOK_SECRET="whsec_sim_$(openssl rand -hex 32)"
  ```

  Para un clúster de verdad, prefiere sealed-secrets o external-secrets.
- La config declarativa de Kong (`infra/kong/kong.yaml`) es un **ConfigMap con
  plantilla**: el marcador `__JWT_SECRET__` lo sustituye el initContainer
  `render-kong-config` leyendo el Secret, y el resultado vive en un `emptyDir`.
  Un ConfigMap no es sitio para secretos.
- Los servicios corren **migraciones TypeORM** al arrancar (`migrationsRun: true`);
  sobre volúmenes vacíos crean el schema desde cero. Ver [docs/migrations.md](../../docs/migrations.md).
- HPA escala por CPU al 70% (notification al 80%, max 2, por su estado en memoria).
