FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer — only re-runs if package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
