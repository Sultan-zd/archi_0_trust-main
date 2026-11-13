#!/bin/sh
# Deploiement des contrats sur le noeud Hardhat du compose (execute par le service "deploy").
set -e

FILE=../deployments/localhost.json

echo "Attente du noeud ${HARDHAT_RPC_URL}..."
i=0
until node docker/rpc-ready.mjs; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then echo "Noeud Hardhat injoignable."; exit 1; fi
  sleep 2
done

if [ -s "$FILE" ] && node docker/already-deployed.mjs "$FILE"; then
  echo "Contrats deja deployes sur ce noeud : rien a faire."
  exit 0
fi

# Les contrats sont deja compiles dans l'image (voir Dockerfile) : inutile de retelecharger le compilateur.
npx hardhat run --no-compile scripts/deploy.js --network localhost
