# The Node version should always match what's in .nvmrc.

# --- deps stage: install production dependencies only ---
FROM node:18.18.1-slim AS deps
WORKDIR /opt/cboard-api/
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# --- runtime stage: slim image with only what's needed to run ---
FROM node:18.18.1-slim AS runtime
ENV NODE_ENV=production
WORKDIR /opt/cboard-api/

COPY --from=deps /opt/cboard-api/node_modules ./node_modules
COPY . .

USER node
EXPOSE 80 10010
CMD [ "node", "app.js" ]
