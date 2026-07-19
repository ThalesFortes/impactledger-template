/**
 * Diagnóstico: consulta owner() dos contratos deployados na rede atual.
 * Não envia nenhuma transação — apenas leitura.
 *
 * Uso: npx hardhat run scripts/check-owners.js --network sepolia
 */
const { ethers, network } = require("hardhat");

const CONTRACTS = [
  { name: "GreenTrace",       address: "0x1CFF6500625d6858826a92d6ce38B684e21E570b" },
  { name: "ImpactToken",      address: "0xE5870db9acc7165B5333ABc341CE8EdA5B6A01B5" },
  { name: "ImpactGovernance", address: "0x5A2ADc4885665fF62120be3bf03D746B8FF76f39" },
];

const OWNABLE_ABI = ["function owner() view returns (address)"];

async function main() {
  console.log(`Rede: ${network.name}\n`);

  for (const { name, address } of CONTRACTS) {
    const code = await ethers.provider.getCode(address);
    if (code === "0x") {
      console.log(`${name} (${address}): ❌ sem bytecode nesta rede`);
      continue;
    }

    const contract = new ethers.Contract(address, OWNABLE_ABI, ethers.provider);
    try {
      const owner = await contract.owner();
      console.log(`${name} (${address}): owner = ${owner}`);
    } catch (err) {
      console.log(`${name} (${address}): sem função owner() (contrato não-Ownable ou call revertida)`);
    }
  }
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
