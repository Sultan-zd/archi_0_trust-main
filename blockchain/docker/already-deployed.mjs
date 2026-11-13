// Sortie 0 si les contrats de ../deployments/localhost.json existent deja sur le noeud courant.
// Evite de redeployer (et de changer les adresses sous les pieds de l'API) quand `docker compose up` est relance
// alors que le noeud tourne encore. Apres un `docker compose down`, le noeud repart vide : on redeploie.
import fs from "node:fs";

const rpc = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
const file = process.argv[2] || "../deployments/localhost.json";

try {
  const address = JSON.parse(fs.readFileSync(file, "utf8")).contracts.IdentityRegistry.address;
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
  });
  const { result } = await res.json();
  process.exit(typeof result === "string" && result !== "0x" ? 0 : 1);
} catch {
  process.exit(1);
}
