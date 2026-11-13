# Attaquant de demonstration : flood SYN avec hping3, lance depuis le reseau du conteneur API
# (voir docker-compose.yml, profil "attack"). Le sniffer, dans le meme reseau, le detecte.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends hping3 \
    && rm -rf /var/lib/apt/lists/*

CMD ["sh", "-c", "echo \"🔴 Flood SYN sur 127.0.0.1:8000 pendant ${ATTACK_SECONDS:-20}s...\"; timeout ${ATTACK_SECONDS:-20} hping3 --flood --syn -p 8000 127.0.0.1; echo \"Attaque terminee.\""]
