FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx nuxt prepare && npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Apply any new database changes, then start the app.
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
