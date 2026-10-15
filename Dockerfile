FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Uploaded enrollment documents live here at runtime (mounted as a volume in k8s)
RUN mkdir -p /app/uploads/enrollments /app/data && chown -R node:node /app/uploads /app/data
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
