FROM node:18-bullseye-slim

# Instala o Chromium e as dependências para o WhatsApp Web rodar
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configura a pasta de trabalho
WORKDIR /app

# Copia os arquivos e instala as dependências
COPY package*.json ./
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta que o backend usa
EXPOSE 3001

CMD ["node", "index.js"]
