/**
 * Transfere GreenTrace.owner para uma nova carteira.
 * Escopo fixo: SOMENTE GreenTrace. Não toca em ImpactToken (deve continuar
 * owned pelo próprio GreenTrace) nem em _governance/_auditor.
 *
 * Uso: NEW_OWNER=0x... npx hardhat run scripts/transfer-ownership.js --network sepolia
 */
const { ethers, network } = require("hardhat");

const GREENTRACE_ADDRESS = "0x1CFF6500625d6858826a92d6ce38B684e21E570b";

async function main() {
  const newOwner = process.env.NEW_OWNER;
  if (!newOwner) {
    console.log("NEW_OWNER não definido — nada a fazer. Abortando sem enviar transação.");
    return;
  }

  if (!ethers.isAddress(newOwner)) {
    throw new Error(`NEW_OWNER inválido: ${newOwner}`);
  }
  const newOwnerChecksum = ethers.getAddress(newOwner);
  if (newOwnerChecksum === ethers.ZeroAddress) {
    throw new Error("NEW_OWNER não pode ser o endereço zero.");
  }

  const [signer] = await ethers.getSigners();
  const ledger = await ethers.getContractAt("GreenTrace", GREENTRACE_ADDRESS, signer);

  const currentOwner = await ledger.owner();
  console.log(`Rede: ${network.name}`);
  console.log(`GreenTrace:  ${GREENTRACE_ADDRESS}`);
  console.log(`Signer:      ${signer.address}`);
  console.log(`Owner atual: ${currentOwner}`);

  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Signer (${signer.address}) não é o owner atual (${currentOwner}). ` +
      `Abortando — configure PRIVATE_KEY no .env com a chave da carteira owner.`
    );
  }

  if (newOwnerChecksum.toLowerCase() === currentOwner.toLowerCase()) {
    throw new Error("NEW_OWNER é igual ao owner atual — nada a transferir.");
  }

  console.log(`\nTransferindo ownership → ${newOwnerChecksum} ...`);
  const tx = await ledger.transferOwnership(newOwnerChecksum);
  console.log(`  tx enviada: ${tx.hash}`);
  await tx.wait(1);

  const updatedOwner = await ledger.owner();
  console.log(`\nOwner depois: ${updatedOwner}`);

  if (updatedOwner.toLowerCase() === newOwnerChecksum.toLowerCase()) {
    console.log("✅ Transferência confirmada.");
  } else {
    console.log("❌ Owner pós-transação não corresponde ao esperado — verifique manualmente.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Erro:", err.message);
  process.exit(1);
});
