/**
 * Configura contratos já deployados: setToken, setGovernance, transferOwnership.
 * Usar quando o deploy.js falhou na fase de configuração mas os contratos já estão na chain.
 *
 * Uso: npm run configure
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOY_DIR = path.join(__dirname, "..", "deployments");

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendTx(description, txPromise) {
  console.log(`  → ${description}...`);
  const tx = await txPromise;
  await tx.wait(1);
  await wait(3000);
  console.log(`  ✓ ${description}`);
}

async function main() {
  const deploymentPath = path.join(DEPLOY_DIR, `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌  deployments/" + network.name + ".json não encontrado. Rode npm run deploy:" + network.name + " primeiro.");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { address: ledgerAddress, tokenAddress, governanceAddress } = data;

  if (!ledgerAddress || !tokenAddress || !governanceAddress) {
    console.error("❌  Endereços incompletos no deployment. Verifique deployments/" + network.name + ".json");
    process.exit(1);
  }

  console.log("Configurando contratos em", network.name);
  console.log("  GreenTrace:      ", ledgerAddress);
  console.log("  ImpactToken:     ", tokenAddress);
  console.log("  ImpactGovernance:", governanceAddress);

  const ledger     = await ethers.getContractAt("GreenTrace",      ledgerAddress);
  const token      = await ethers.getContractAt("ImpactToken",     tokenAddress);

  // Verifica estado atual para não repetir chamadas já feitas
  const currentToken  = await ledger.getToken();
  const currentGov    = await ledger.getGovernance();
  const tokenOwner    = await token.owner();

  const zeroAddr = "0x0000000000000000000000000000000000000000";

  if (currentToken.toLowerCase() === zeroAddr) {
    await sendTx("ledger.setToken", ledger.setToken(tokenAddress));
  } else {
    console.log("  ✓ ledger.setToken (já configurado:", currentToken, ")");
  }

  if (currentGov.toLowerCase() === zeroAddr) {
    await sendTx("ledger.setGovernance", ledger.setGovernance(governanceAddress));
  } else {
    console.log("  ✓ ledger.setGovernance (já configurado:", currentGov, ")");
  }

  if (tokenOwner.toLowerCase() !== ledgerAddress.toLowerCase()) {
    await sendTx("token.transferOwnership → GreenTrace", token.transferOwnership(ledgerAddress));
  } else {
    console.log("  ✓ token.owner (já é GreenTrace)");
  }

  data.configured = true;
  fs.writeFileSync(deploymentPath, JSON.stringify(data, null, 2));

  // Atualiza .env.local do frontend
  if (network.name === "sepolia") {
    require("./sync-env");
  }

  console.log("\n✅ Configuração concluída!");
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});
