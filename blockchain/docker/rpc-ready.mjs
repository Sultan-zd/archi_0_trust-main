// Sortie 0 si le noeud JSON-RPC repond (utilise par le healthcheck et par deploy.sh).
const rpc = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";

try {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
  });
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
