import os
import threading
import time

import redis
from scapy.all import sniff, IP, TCP

# Configuration (valeurs par defaut = lancement manuel sur la machine ; sous Docker, voir docker-compose.yml)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
IFACE = os.getenv("SNIFF_IFACE", "lo")
ATTACK_THRESHOLD = int(os.getenv("ATTACK_THRESHOLD", "100"))  # Seuil bas pour detecter aussi les scans (plus lents)
WINDOW_SECONDS = 2

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
lock = threading.Lock()
packet_count = 0
flagged_by_us = False


def process_packet(packet):
    """On compte tous les paquets SYN, peu importe le port de destination."""
    global packet_count
    if IP in packet and TCP in packet and packet[TCP].flags == "S":
        with lock:
            packet_count += 1


def evaluate_loop():
    """Evalue une fenetre toutes les WINDOW_SECONDS, meme sans nouveau paquet : l'etat d'attaque retombe donc
    tout seul a la fin d'un flood. Le sniffer n'efface que le drapeau qu'il a lui-meme leve (celui du bouton
    « Lancer l'attaque » du dashboard admin n'est pas touche)."""
    global packet_count, flagged_by_us
    while True:
        time.sleep(WINDOW_SECONDS)
        with lock:
            count, packet_count = packet_count, 0
        try:
            if count > ATTACK_THRESHOLD:
                print(f"⚠️ Attaque détectée ! {count} SYN en {WINDOW_SECONDS}s.", flush=True)
                r.set("attack_active", "1")
                flagged_by_us = True
            elif flagged_by_us:
                print("✅ Trafic redevenu normal.", flush=True)
                r.delete("attack_active")
                flagged_by_us = False
        except redis.RedisError as e:
            print(f"Redis indisponible : {e}", flush=True)


threading.Thread(target=evaluate_loop, daemon=True).start()
print(f"🔍 Sniffer actif sur « {IFACE} » (Redis {REDIS_HOST}:{REDIS_PORT}). En attente de scans ou floods SYN...", flush=True)
sniff(iface=IFACE, prn=process_packet, store=0, filter="tcp")
