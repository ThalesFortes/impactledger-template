/**
 * Diagnóstico: consulta getAuditor() e getGovernance() do GreenTrace.
 * Apenas leitura — nenhuma transação enviada.
 *
 * Uso: npx hardhat run scripts/check-privileged.js --network sepolia
 */
const { ethers, network } = require("hardhat");

const GREENTRACE_ADDRESS = "0x1CFF6500625d6858826a92d6ce38B684e21E570b";
const GOVERNANCE_ADDRESS = "0x5A2ADc4885665fF62120be3bf03D746B8FF76f39";
const COMPROMISED = "0x871A2dE4748784b259BBD8ED203cb932A0E68d2e";

async function main() {
  console.log(`Rede: ${network.name}\n`);

  const ledger = await ethers.getContractAt("GreenTrace", GREENTRACE_ADDRESS);

  const auditor = await ledger.getAuditor();
  const governance = await ledger.getGovernance();

  const flag = (addr) => addr.toLowerCase() === COMPROMISED.toLowerCase() ? "  ⚠ APONTA PARA A CARTEIRA COMPROMETIDA" : "";

  console.log(`_auditor    = ${auditor}${flag(auditor)}`);
  console.log(`_governance = ${governance}${flag(governance)}`);
  console.log(`\nEsperado para _governance: ${GOVERNANCE_ADDRESS} (contrato ImpactGovernance)`);
  console.log(`Match: ${governance.toLowerCase() === GOVERNANCE_ADDRESS.toLowerCase() ? "✓ sim" : "✗ NÃO — diverge do esperado"}`);
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
