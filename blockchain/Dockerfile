# Noeud Hardhat local et deploiement des contrats.
FROM node:22-slim

WORKDIR /app/blockchain
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Compile les contrats a la construction de l'image (telecharge solc une seule fois).
RUN npx hardhat build
# deploy.js ecrit les adresses et ABI dans ../deployments (= volume partage avec l'API).
RUN mkdir -p /app/deployments

EXPOSE 8545
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0", "--port", "8545"]
