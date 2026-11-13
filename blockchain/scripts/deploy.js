import { network } from "hardhat";
import fs from "fs";
import path from "path";

const { ethers } = await network.connect({ network: "localhost" });

const Role = { User: 1, Fleet: 2, Admin: 3 };

const POLICIES = {
  "charge:start": { minRole: Role.User, mfaThreshold: 30, denyThreshold: 60, startHour: 0, endHour: 0, requireTrustedDevice: false, active: true },
  "charge:stop": { minRole: Role.User, mfaThreshold: 40, denyThreshold: 70, startHour: 0, endHour: 0, requireTrustedDevice: false, active: true },
  "billing:read": { minRole: Role.User, mfaThreshold: 30, denyThreshold: 60, startHour: 0, endHour: 0, requireTrustedDevice: false, active: true },
  "fleet:dashboard": { minRole: Role.Fleet, mfaThreshold: 25, denyThreshold: 55, startHour: 6, endHour: 22, requireTrustedDevice: false, active: true },
  "admin:firmware": { minRole: Role.Admin, mfaThreshold: 20, denyThreshold: 40, startHour: 6, endHour: 20, requireTrustedDevice: true, active: true },
};

async function main() {
  const [admin] = await ethers.getSigners();
  console.log(`Réseau : localhost - compte administrateur : ${admin.address}`);

  const registry = await ethers.deployContract("IdentityRegistry", [admin.address]);
  await registry.waitForDeployment();

  const policy = await ethers.deployContract("AccessPolicy", [admin.address, await registry.getAddress()]);
  await policy.waitForDeployment();

  const audit = await ethers.deployContract("AuditLog", [admin.address]);
  await audit.waitForDeployment();

  for (const [resource, p] of Object.entries(POLICIES)) {
    const tx = await policy.setPolicy(ethers.id(resource), p);
    await tx.wait();
    console.log(`Politique « ${resource} » créée`);
  }

  const out = {
    network: "localhost",
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: admin.address,
    deployedAt: new Date().toISOString(),
    resources: Object.keys(POLICIES),
    contracts: {
      IdentityRegistry: { address: await registry.getAddress(), abi: JSON.parse(fs.readFileSync("./artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json")).abi },
      AccessPolicy: { address: await policy.getAddress(), abi: JSON.parse(fs.readFileSync("./artifacts/contracts/AccessPolicy.sol/AccessPolicy.json")).abi },
      AuditLog: { address: await audit.getAddress(), abi: JSON.parse(fs.readFileSync("./artifacts/contracts/AuditLog.sol/AuditLog.json")).abi },
    },
  };

  const outDir = path.join("..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "localhost.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

  console.log("IdentityRegistry:", out.contracts.IdentityRegistry.address);
  console.log("AccessPolicy:", out.contracts.AccessPolicy.address);
  console.log("AuditLog:", out.contracts.AuditLog.address);
  console.log(`Adresses et ABI écrites dans ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
