/**
 * Lê deployments/sepolia.json e atualiza NEXT_PUBLIC_CONTRACT_ADDRESS,
 * NEXT_PUBLIC_TOKEN_ADDRESS e NEXT_PUBLIC_GOVERNANCE_ADDRESS
 * em frontend/.env.local automaticamente.
 *
 * Uso: npm run sync-env
 * Chamado automaticamente ao final de deploy:sepolia.
 */

const fs = require("fs");
const path = require("path");

const deploymentPath  = path.join(__dirname, "..", "deployments", "sepolia.json");
const envPath         = path.join(__dirname, "..", "frontend", ".env.local");
const envExamplePath  = path.join(__dirname, "..", "frontend", ".env.local.example");

if (!fs.existsSync(deploymentPath)) {
  console.error("❌  deployments/sepolia.json não encontrado. Execute npm run deploy:sepolia primeiro.");
  process.exit(1);
}

const { address, tokenAddress, governanceAddress } = JSON.parse(
  fs.readFileSync(deploymentPath, "utf8")
);

let envContent = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : fs.existsSync(envExamplePath)
    ? fs.readFileSync(envExamplePath, "utf8")
    : "";

function upsertEnvVar(content, key, value) {
  if (content.includes(`${key}=`)) {
    return content.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

envContent = upsertEnvVar(envContent, "NEXT_PUBLIC_CONTRACT_ADDRESS",   address);
envContent = upsertEnvVar(envContent, "NEXT_PUBLIC_TOKEN_ADDRESS",      tokenAddress      ?? "");
envContent = upsertEnvVar(envContent, "NEXT_PUBLIC_GOVERNANCE_ADDRESS", governanceAddress ?? "");

fs.writeFileSync(envPath, envContent);
console.log(`✅  frontend/.env.local atualizado:`);
console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS   = ${address}`);
console.log(`   NEXT_PUBLIC_TOKEN_ADDRESS      = ${tokenAddress ?? "(não deployado)"}`);
console.log(`   NEXT_PUBLIC_GOVERNANCE_ADDRESS = ${governanceAddress ?? "(não deployado)"}`);
