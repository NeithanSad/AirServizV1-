# Lambda container image — la vía recomendada para desplegar esta función.
# sharp usa binarios nativos (libvips): construir la imagen EN linux/amd64
# garantiza que los binarios coinciden con el runtime de Lambda, sin pelear
# con `npm install --platform=linux` en Windows/macOS.
FROM public.ecr.aws/lambda/nodejs:20

COPY package*.json ${LAMBDA_TASK_ROOT}/
RUN npm install --omit=dev

COPY index.mjs ${LAMBDA_TASK_ROOT}/

CMD ["index.handler"]
