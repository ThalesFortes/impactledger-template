/**
 * Gera um comprovante PDF de gasto do GreenTrace.
 *
 * Uso:
 *   npm run receipt
 *   npm run receipt -- --id=2 --pool="Projeto X" --desc="Descrição" --amount=0.5 --beneficiary=0xABC...
 *
 * Argumentos (todos opcionais, sobrepõem os defaults abaixo):
 *   --id           ID do gasto (default: 1)
 *   --pool         Nome do fundo
 *   --category     Categoria
 *   --desc         Descrição do gasto
 *   --amount       Valor em ETH (ex: 0.3)
 *   --brl          Valor estimado em BRL (ex: "R$ 9.000,00")
 *   --beneficiary  Endereço do beneficiário
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const match = arg.match(/^--([^=]+)=?(.*)?$/);
    if (match) args[match[1]] = match[2] ?? true;
  });
  return args;
}

function readContractAddress() {
  const deploymentPath = path.join(__dirname, "..", "deployments", "sepolia.json");
  if (fs.existsSync(deploymentPath)) {
    return JSON.parse(fs.readFileSync(deploymentPath, "utf8")).address;
  }
  return "0x0000000000000000000000000000000000000000";
}

const cli = parseArgs();

// ─── Defaults (editáveis) — sobrescritos por args CLI ────────────────────────
const receipt = {
  poolName:        cli.pool        ?? "Projeto Reciclagem 2024",
  category:        cli.category    ?? "Meio Ambiente",
  description:     cli.desc        ?? "Compra de mudas para reflorestamento urbano",
  amountEth:       cli.amount      ?? "0.3",
  amountBrl:       cli.brl         ?? "R$ 9.000,00",
  beneficiary:     cli.beneficiary ?? "0xe9DC403dD61f25a715603A4301e1516064ECD49a",
  contractAddress: readContractAddress(),
  txDate: new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }),
  expenditureId: cli.id ?? "1",
  network: "Sepolia Testnet",
};
// ─────────────────────────────────────────────────────────────────────────────

const outputDir = path.join(__dirname, "..", "receipts");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const outputPath = path.join(outputDir, `comprovante-gasto-${receipt.expenditureId}.pdf`);
const doc = new PDFDocument({ size: "A4", margin: 50 });
doc.pipe(fs.createWriteStream(outputPath));

const GREEN = "#10b981";
const DARK = "#111827";
const GRAY = "#6b7280";
const LIGHT_GRAY = "#f9fafb";
const WHITE = "#ffffff";

// ─── Cabeçalho ───────────────────────────────────────────────────────────────
doc.rect(0, 0, 595, 90).fill(DARK);
doc.fillColor(GREEN).fontSize(22).font("Helvetica-Bold").text("Impact", 50, 30, { continued: true });
doc.fillColor(WHITE).text("Ledger");
doc.fillColor("#9ca3af").fontSize(10).font("Helvetica").text("Sistema de Transparência On-Chain", 50, 58);
doc.fillColor(GREEN).fontSize(10).text("COMPROVANTE DE GASTO", 400, 40, { align: "right", width: 145 });
doc.fillColor("#9ca3af").fontSize(9).text(`#${receipt.expenditureId}`, 400, 56, { align: "right", width: 145 });

// ─── Faixa de status ─────────────────────────────────────────────────────────
doc.rect(0, 90, 595, 30).fill("#064e3b");
doc.fillColor("#6ee7b7").fontSize(10).font("Helvetica-Bold")
  .text("✓  GASTO REGISTRADO NA BLOCKCHAIN — IMUTÁVEL E AUDITÁVEL", 50, 99);

// ─── Corpo ───────────────────────────────────────────────────────────────────
let y = 145;

function sectionTitle(label) {
  doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold")
    .text(label.toUpperCase(), 50, y);
  y += 14;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
  y += 10;
}

function row(label, value, highlight = false) {
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(label, 50, y, { width: 160 });
  doc.fillColor(highlight ? GREEN : DARK).fontSize(9)
    .font(highlight ? "Helvetica-Bold" : "Helvetica")
    .text(value, 220, y, { width: 325 });
  y += 20;
}

// Dados do fundo
sectionTitle("Dados do Fundo");
row("Fundo", receipt.poolName);
row("Categoria", receipt.category);
y += 5;

// Dados do gasto
sectionTitle("Dados do Gasto");
row("Descrição", receipt.description);
row("Valor (ETH)", `${receipt.amountEth} ETH`, true);
if (receipt.amountBrl) row("Valor estimado (BRL)", receipt.amountBrl);
row("Data de Registro", receipt.txDate);
y += 5;

// Dados blockchain
sectionTitle("Registro Blockchain");
row("Rede", receipt.network);
row("Contrato", receipt.contractAddress);
row("Beneficiário", receipt.beneficiary);
y += 5;

// ─── Box de verificação ──────────────────────────────────────────────────────
doc.rect(50, y, 495, 60).fill(LIGHT_GRAY).stroke("#e5e7eb");
doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold")
  .text("Como verificar este comprovante:", 65, y + 10);
doc.fillColor(GRAY).fontSize(8.5).font("Helvetica")
  .text(
    `Acesse https://sepolia.etherscan.io/address/${receipt.contractAddress} e procure o evento "ExpenditureRegistered" com ID #${receipt.expenditureId}. Todos os dados acima estão gravados de forma imutável na blockchain.`,
    65, y + 25, { width: 465 }
  );
y += 80;

// ─── Rodapé ──────────────────────────────────────────────────────────────────
doc.rect(0, 760, 595, 82).fill(DARK);
doc.fillColor("#9ca3af").fontSize(8).font("Helvetica")
  .text(
    "Este documento foi gerado automaticamente pelo sistema GreenTrace. As informações registradas na blockchain são imutáveis e verificáveis publicamente.",
    50, 772, { width: 495, align: "center" }
  );
doc.fillColor(GREEN).fontSize(8)
  .text("greentrace.vercel.app", 50, 792, { width: 495, align: "center" });

doc.end();

doc.on("finish", () => {
  console.log("✅ Comprovante gerado:", outputPath);
  console.log("   Agora suba este arquivo no Pinata (pinata.cloud) e copie o CID.");
});
