const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOY_DIR = path.join(__dirname, "..", "deployments");

function save(data) {
  if (!fs.existsSync(DEPLOY_DIR)) fs.mkdirSync(DEPLOY_DIR);
  fs.writeFileSync(
    path.join(DEPLOY_DIR, `${network.name}.json`),
    JSON.stringify(data, null, 2)
  );
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendTx(description, txPromise) {
  console.log(`  → ${description}...`);
  const tx = await txPromise;
  await tx.wait(1);
  await wait(3000); // pausa para o nó indexar antes da próxima tx
  console.log(`  ✓ ${description}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying com:", deployer.address);
  console.log("Saldo:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Verifica se já há um deployment salvo para esta rede (retomada após falha)
  const deploymentPath = path.join(DEPLOY_DIR, `${network.name}.json`);
  let existing = null;
  if (fs.existsSync(deploymentPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      if (existing.address && existing.tokenAddress && existing.governanceAddress) {
        console.log("\n⚠  Deployment existente encontrado para", network.name);
        console.log("   Use npm run configure para apenas configurar os contratos já deployados.");
        console.log("   Ou delete deployments/" + network.name + ".json e rode novamente para fazer um novo deploy.");
        process.exit(0);
      }
    } catch { existing = null; }
  }

  // ── 1. ImpactToken ────────────────────────────────────────────────────────
  console.log("\n[1/3] Deployando ImpactToken...");
  const TokenFactory = await ethers.getContractFactory("ImpactToken");
  const token = await TokenFactory.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("  ImpactToken:", tokenAddress);
  await wait(3000);

  // ── 2. GreenTrace ─────────────────────────────────────────────────────────
  console.log("\n[2/3] Deployando GreenTrace...");
  const LedgerFactory = await ethers.getContractFactory("GreenTrace");
  const ledger = await LedgerFactory.deploy();
  await ledger.waitForDeployment();
  const ledgerAddress = await ledger.getAddress();
  console.log("  GreenTrace:", ledgerAddress);
  await wait(3000);

  // ── 3. ImpactGovernance ───────────────────────────────────────────────────
  console.log("\n[3/3] Deployando ImpactGovernance...");
  const GovFactory = await ethers.getContractFactory("ImpactGovernance");
  const governance = await GovFactory.deploy(tokenAddress, ledgerAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("  ImpactGovernance:", governanceAddress);
  await wait(3000);

  // ── Salva endereços ANTES de configurar (permite retomada em caso de falha) ──
  const deploymentData = {
    address: ledgerAddress,
    tokenAddress,
    governanceAddress,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    configured: false,
  };
  save(deploymentData);
  console.log("\n  Endereços salvos em deployments/" + network.name + ".json");

  // ── Configuração ─────────────────────────────────────────────────────────
  console.log("\nConfigurando contratos...");
  await sendTx("ledger.setToken", ledger.setToken(tokenAddress));
  await sendTx("ledger.setGovernance", ledger.setGovernance(governanceAddress));
  await sendTx("token.transferOwnership → GreenTrace", token.transferOwnership(ledgerAddress));

  deploymentData.configured = true;
  save(deploymentData);

  // ── Copia ABIs para o frontend ────────────────────────────────────────────
  const frontendAbiDir = path.join(__dirname, "..", "frontend", "src", "lib");
  const artifactsBase  = path.join(__dirname, "..", "artifacts", "contracts");
  const abis = [
    { sol: "GreenTrace.sol/GreenTrace.json",              out: "GreenTraceABI.json" },
    { sol: "ImpactToken.sol/ImpactToken.json",           out: "ImpactTokenABI.json" },
    { sol: "ImpactGovernance.sol/ImpactGovernance.json", out: "ImpactGovernanceABI.json" },
  ];
  if (fs.existsSync(frontendAbiDir)) {
    for (const { sol, out } of abis) {
      const src = path.join(artifactsBase, sol);
      if (fs.existsSync(src)) {
        const artifact = JSON.parse(fs.readFileSync(src, "utf8"));
        fs.writeFileSync(path.join(frontendAbiDir, out), JSON.stringify(artifact.abi, null, 2));
      }
    }
    console.log("  ABIs copiadas para o frontend ✓");
  }

  // ── Sincroniza .env.local ─────────────────────────────────────────────────
  if (network.name === "sepolia") {
    require("./sync-env");
  }

  console.log("\n✅ Deploy e configuração concluídos!");
  console.log("   GreenTrace:      ", ledgerAddress);
  console.log("   ImpactToken:     ", tokenAddress);
  console.log("   ImpactGovernance:", governanceAddress);
  if (network.name === "sepolia") {
    console.log("\n   Etherscan:");
    console.log("   →", `https://sepolia.etherscan.io/address/${ledgerAddress}`);
    console.log("   →", `https://sepolia.etherscan.io/address/${tokenAddress}`);
    console.log("   →", `https://sepolia.etherscan.io/address/${governanceAddress}`);
  }
}

main().catch((err) => {
  console.error("\n❌ Erro durante o deploy:", err.message);
  console.error("   Os endereços já deployados foram salvos em deployments/" + network.name + ".json");
  console.error("   Se os 3 contratos estão deployados, rode: npm run configure");
  process.exit(1);
});
