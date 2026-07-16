# image-optimizer — AWS Lambda

Función serverless **independiente de los microservicios**: recibe una imagen
(foto de perfil, imagen de un servicio del catálogo o evidencia de trabajo),
la optimiza con [sharp](https://sharp.pixelplumbing.com/) (resize a máx.
1024px + conversión a WebP calidad 80) y la sube a **S3**. Devuelve la URL
pública para que el microservicio la persista.

```
user-service / catalog-service ──InvokeCommand──► Lambda ──PutObject──► S3
        ▲                                            │
        └────────── { url, key, reduction } ◄────────┘
```

¿Por qué Lambda y no un endpoint más en un microservicio? El procesamiento de
imágenes es **CPU-intensivo y esporádico**: escala a cero cuando nadie sube
fotos y a N en paralelo cuando hay ráfagas, sin robarle CPU a los pods que
atienden tráfico transaccional.

## Probar el pipeline localmente (sin cuenta AWS)

```bash
cd serverless/image-optimizer
npm install
npm run test:local     # genera una imagen 2000px → verifica webp 1024px más liviano
```

## Infraestructura desplegada (AWS real — no simulada)

| Recurso | Valor |
|---|---|
| Cuenta AWS | `960422538066` |
| Región | `us-east-1` |
| Bucket S3 | `airserviz-media-960422538066` — lectura pública de objetos (`s3:GetObject`), listado y ACLs públicas bloqueados |
| Repositorio ECR | `960422538066.dkr.ecr.us-east-1.amazonaws.com/airserviz-image-optimizer` |
| Rol IAM | `arn:aws:iam::960422538066:role/airserviz-lambda-s3-role` — solo `AWSLambdaBasicExecutionRole` (logs) + `s3:PutObject` acotado a este bucket |
| Función Lambda | `arn:aws:lambda:us-east-1:960422538066:function:airserviz-image-optimizer` — 1024MB, timeout 30s |

Verificado con una invocación real: PNG 8.9KB → WebP 1.5KB (83% más liviana),
subida a S3 y accesible públicamente (`200`).

## Desplegar desde cero (si se recrea en otra cuenta)

sharp usa binarios nativos de libvips; empaquetarlo como **container image**
evita incompatibilidades entre tu SO y el runtime de Lambda. **Importante:**
Docker moderno agrega attestations (provenance/SBOM) por defecto, que
convierten la imagen en un manifest-list — **Lambda no lo acepta**. Hay que
desactivarlas explícitamente (`--provenance=false --sbom=false`).

```bash
AWS_ACCOUNT=<tu-cuenta>
REGION=us-east-1
BUCKET=airserviz-media-$AWS_ACCOUNT

# 1. Bucket (lectura pública de objetos, sin listado — ver bucket policy abajo)
aws s3api create-bucket --bucket $BUCKET --region $REGION
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket $BUCKET --policy '{
  "Version": "2012-10-17",
  "Statement": [{ "Sid": "PublicReadOnly", "Effect": "Allow", "Principal": "*",
    "Action": "s3:GetObject", "Resource": "arn:aws:s3:::'$BUCKET'/*" }]
}'

# 2. Construir y subir la imagen (SIN attestations — ver nota arriba)
aws ecr create-repository --repository-name airserviz-image-optimizer
aws ecr get-login-password | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build --platform linux/amd64 --provenance=false --sbom=false -t airserviz-image-optimizer .
docker tag airserviz-image-optimizer:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/airserviz-image-optimizer:latest
docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/airserviz-image-optimizer:latest

# 3. Rol IAM — solo logs + PutObject en ESE bucket, nada más
aws iam create-role --role-name airserviz-lambda-s3-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole" }]
}'
aws iam attach-role-policy --role-name airserviz-lambda-s3-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name airserviz-lambda-s3-role --policy-name PutObjectToMediaBucket \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{ "Sid": "PutOptimizedImages", "Effect": "Allow", "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::'$BUCKET'/*" }]
  }'

# 4. Crear la función (espera ~10s tras crear el rol — IAM tarda en propagar)
aws lambda create-function \
  --function-name airserviz-image-optimizer \
  --package-type Image \
  --code ImageUri=$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/airserviz-image-optimizer:latest \
  --role arn:aws:iam::$AWS_ACCOUNT:role/airserviz-lambda-s3-role \
  --timeout 30 --memory-size 1024 \
  --environment "Variables={S3_BUCKET=$BUCKET}"
```

Prueba rápida desde la CLI:

```bash
aws lambda invoke --function-name airserviz-image-optimizer \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"imageBase64\":\"$(base64 -w0 foto.jpg)\",\"filename\":\"foto.jpg\",\"folder\":\"profiles\"}" \
  out.json && cat out.json
```

## Invocarla desde user-service (o catalog-service)

Instala el SDK en el microservicio: `npm i @aws-sdk/client-lambda`

```ts
// src/media/lambda-image.client.ts (user-service)
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export interface OptimizedImage {
  success: boolean;
  url: string;
  key: string;
  reduction: string;
}

@Injectable()
export class LambdaImageClient {
  private readonly logger = new Logger(LambdaImageClient.name);
  private readonly lambda = new LambdaClient({});
  private readonly fn: string;

  constructor(config: ConfigService) {
    this.fn = config.get('IMAGE_OPTIMIZER_FN', 'airserviz-image-optimizer');
  }

  async optimize(imageBase64: string, filename: string, folder: 'profiles' | 'services') {
    const res = await this.lambda.send(
      new InvokeCommand({
        FunctionName: this.fn,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ imageBase64, filename, folder }),
      }),
    );
    const parsed = JSON.parse(new TextDecoder().decode(res.Payload)) as OptimizedImage;
    this.logger.log(`Imagen optimizada → ${parsed.url} (${parsed.reduction} más liviana)`);
    return parsed;
  }
}
```

Y en el flujo existente de perfiles:

```ts
// profiles.service.ts — al actualizar el perfil con photoBase64
const { url } = await this.lambdaImages.optimize(dto.photoBase64, 'perfil.jpg', 'profiles');
profile.photoUrl = url; // se persiste la URL de S3, no la imagen
```

El microservicio necesita credenciales AWS con permiso `lambda:InvokeFunction`
(en K8s: IRSA o un Secret con `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`).

## Alternativa asíncrona (S3 trigger)

Para desacoplar por completo: el frontend sube el original a
`s3://airserviz-media/raw/` con una URL prefirmada, y un **S3 event
notification** (`s3:ObjectCreated:*` sobre `raw/`) dispara esta misma Lambda,
que escribe el optimizado en `optimized/` y (opcionalmente) publica un evento.
Ventaja: el microservicio nunca toca bytes de imagen. Costo: consistencia
eventual (la URL optimizada no está disponible en la misma request).

## Regla arquitectónica

La Lambda **no toca ninguna base de datos** de los microservicios
(database-per-service se mantiene): solo transforma bytes y escribe en S3.
El dueño del dato (user-service para `photoUrl`, catalog-service para
`imageUrl`) persiste la URL en SU propia BD.
