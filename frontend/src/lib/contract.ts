import { ethers } from "ethers";
import ABI          from "./GreenTraceABI.json";
import TOKEN_ABI    from "./ImpactTokenABI.json";
import GOV_ABI      from "./ImpactGovernanceABI.json";

export const CONTRACT_ADDRESS    = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS    || "";
export const TOKEN_ADDRESS       = process.env.NEXT_PUBLIC_TOKEN_ADDRESS       || "";
export const GOVERNANCE_ADDRESS  = process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS  || "";
export const SEPOLIA_RPC         = process.env.NEXT_PUBLIC_SEPOLIA_RPC         || "https://rpc.sepolia.org";

export const CATEGORY_ODS: Record<string, { ids: number[]; label: string }> = {
  "Meio Ambiente": { ids: [13, 15], label: "Ação Climática · Vida Terrestre" },
  "Educação":      { ids: [4],      label: "Educação de Qualidade" },
  "Saúde":         { ids: [3],      label: "Saúde e Bem-Estar" },
  "Social":        { ids: [1, 10],  label: "Erradicação da Pobreza · Redução das Desigualdades" },
  "Cultura":       { ids: [11],     label: "Cidades e Comunidades Sustentáveis" },
  "ESG":           { ids: [17],     label: "Parcerias para os Objetivos" },
};

export const PREDEFINED_METRICS = [
  "famílias atendidas",
  "refeições servidas",
  "crianças beneficiadas",
  "pessoas capacitadas",
  "consultas médicas realizadas",
  "mudas plantadas",
  "toneladas recicladas",
  "cestas básicas distribuídas",
  "m² recuperados",
  "horas de mentoria",
] as const;

export interface FundPool {
  id: bigint;
  name: string;
  category: string;
  totalAmount: bigint;
  spentAmount: bigint;
  active: boolean;
  createdAt: bigint;
}

export interface Expenditure {
  id: bigint;
  poolId: bigint;
  description: string;
  amount: bigint;
  fiatAmountCents: bigint;
  fiatCurrency: string;
  beneficiary: string;
  ipfsHash: string;
  confirmedByBeneficiary: boolean;
  timestamp: bigint;
  certificateTokenId: bigint;
  confirmedAt: bigint;
}

export interface ImpactReport {
  expenditureId: bigint;
  beneficiariesCount: bigint;
  metric: string;
  metricValue: bigint;
  metricGoal: bigint;
  location: string;
  reportedAt: bigint;
}

export interface ContractStats {
  totalAllocated: bigint;
  totalSpent: bigint;
  poolCount: bigint;
  expenditureCount: bigint;
  totalBeneficiaries: bigint;
}

// ─── Governança ────────────────────────────────────────────────────────────

export enum ProposalStatus { Active = 0, Executed = 1, Rejected = 2 }

export interface Proposal {
  id: bigint;
  proposer: string;
  targetAuditor: string;
  description: string;
  votesFor: bigint;
  votesAgainst: bigint;
  deadline: bigint;
  totalSupplyAtCreation: bigint;
  snapshotBlock: bigint;
  status: ProposalStatus;
}

// ─── Providers ────────────────────────────────────────────────────────────

function getReadProvider() {
  return new ethers.JsonRpcProvider(SEPOLIA_RPC);
}

function getReadContract() {
  if (!CONTRACT_ADDRESS) throw new Error("Contrato não configurado. Defina NEXT_PUBLIC_CONTRACT_ADDRESS no .env.local");
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
}

function getReadTokenContract() {
  if (!TOKEN_ADDRESS) throw new Error("Token não configurado. Defina NEXT_PUBLIC_TOKEN_ADDRESS no .env.local");
  return new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, getReadProvider());
}

function getReadGovernanceContract() {
  if (!GOVERNANCE_ADDRESS) throw new Error("Governança não configurada. Defina NEXT_PUBLIC_GOVERNANCE_ADDRESS no .env.local");
  return new ethers.Contract(GOVERNANCE_ADDRESS, GOV_ABI, getReadProvider());
}

export async function getWriteContract() {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("MetaMask não encontrado");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

export async function getWriteTokenContract() {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("MetaMask não encontrado");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
}

export async function getWriteGovernanceContract() {
  if (typeof window === "undefined" || !window.ethereum) throw new Error("MetaMask não encontrado");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  return new ethers.Contract(GOVERNANCE_ADDRESS, GOV_ABI, signer);
}

// ─── GreenTrace — leitura ─────────────────────────────────────────────────

const PAGE = 100n; // itens por página nas chamadas paginadas

/** Busca todos os fundos em blocos de 100. */
export async function getAllPools(): Promise<FundPool[]> {
  const contract = getReadContract();
  const all: FundPool[] = [];
  let offset = 0n;
  for (;;) {
    const [page, total]: [FundPool[], bigint] = await contract.getPools(offset, PAGE);
    all.push(...page);
    offset += PAGE;
    if (offset >= total) break;
  }
  return all;
}

export async function getPool(poolId: number): Promise<FundPool> {
  return getReadContract().getPool(poolId);
}

/** Busca todos os gastos de um fundo em blocos de 100. */
export async function getExpendituresByPool(poolId: number): Promise<Expenditure[]> {
  const contract = getReadContract();
  const all: Expenditure[] = [];
  let offset = 0n;
  for (;;) {
    const [page, total]: [Expenditure[], bigint] = await contract.getExpendituresByPool(poolId, offset, PAGE);
    all.push(...page);
    offset += PAGE;
    if (offset >= total) break;
  }
  return all;
}

export async function getRecentExpenditures(limit = 10): Promise<Expenditure[]> {
  return getReadContract().getRecentExpenditures(limit);
}

export async function getStats(): Promise<ContractStats> {
  const [totalAllocated, totalSpent, poolCount, expenditureCount, totalBeneficiaries] =
    await getReadContract().getStats();
  return { totalAllocated, totalSpent, poolCount, expenditureCount, totalBeneficiaries };
}

export async function getImpactReport(expenditureId: number | bigint): Promise<ImpactReport> {
  return getReadContract().getImpactReport(expenditureId);
}

export async function getAuditor(): Promise<string> {
  return getReadContract().getAuditor();
}

export async function isAuditValidated(expenditureId: number | bigint): Promise<boolean> {
  return getReadContract().isAuditValidated(expenditureId);
}

export async function isRejected(expenditureId: number | bigint): Promise<boolean> {
  return getReadContract().isRejected(expenditureId);
}

export async function getTokenURI(tokenId: bigint): Promise<string> {
  return getReadContract().tokenURI(tokenId);
}

export async function getContractOwner(): Promise<string> {
  return getReadContract().owner();
}

// ─── ImpactToken — leitura ────────────────────────────────────────────────

export async function getTokenBalance(address: string): Promise<bigint> {
  if (!TOKEN_ADDRESS) return 0n;
  return getReadTokenContract().balanceOf(address);
}

export async function getTokenTotalSupply(): Promise<bigint> {
  if (!TOKEN_ADDRESS) return 0n;
  return getReadTokenContract().totalSupply();
}

// ─── ImpactGovernance — leitura ───────────────────────────────────────────

function mapProposal(raw: {
  id: bigint; proposer: string; targetAuditor: string; description: string;
  votesFor: bigint; votesAgainst: bigint; deadline: bigint;
  totalSupplyAtCreation: bigint; snapshotBlock: bigint; status: bigint;
}): Proposal {
  return {
    id: raw.id,
    proposer: raw.proposer,
    targetAuditor: raw.targetAuditor,
    description: raw.description,
    votesFor: raw.votesFor,
    votesAgainst: raw.votesAgainst,
    deadline: raw.deadline,
    totalSupplyAtCreation: raw.totalSupplyAtCreation,
    snapshotBlock: raw.snapshotBlock,
    status: Number(raw.status) as ProposalStatus,
  };
}

export async function getAllProposals(): Promise<Proposal[]> {
  if (!GOVERNANCE_ADDRESS) return [];
  const raws = await getReadGovernanceContract().getAllProposals();
  return (raws as typeof raws[]).map(mapProposal);
}

export async function getProposal(proposalId: number | bigint): Promise<Proposal> {
  const raw = await getReadGovernanceContract().getProposal(proposalId);
  return mapProposal(raw);
}

export async function hasVotedOn(proposalId: number | bigint, voter: string): Promise<boolean> {
  if (!GOVERNANCE_ADDRESS) return false;
  return getReadGovernanceContract().hasVotedOn(proposalId, voter);
}

// ─── ImpactGovernance — escrita ───────────────────────────────────────────

export async function proposeAuditor(
  targetAuditor: string,
  description: string
): Promise<ethers.ContractTransactionResponse> {
  const contract = await getWriteGovernanceContract();
  return contract.propose(targetAuditor, description);
}

export async function voteOnProposal(
  proposalId: bigint,
  support: boolean
): Promise<ethers.ContractTransactionResponse> {
  const contract = await getWriteGovernanceContract();
  return contract.vote(proposalId, support);
}

export async function executeProposal(
  proposalId: bigint
): Promise<ethers.ContractTransactionResponse> {
  const contract = await getWriteGovernanceContract();
  return contract.execute(proposalId);
}

// ─── NFT helpers ─────────────────────────────────────────────────────────

export interface NFTMeta {
  name: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
}

export function parseTokenURI(uri: string): NFTMeta | null {
  try {
    const base64 = uri.replace("data:application/json;base64,", "");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// ─── Formatação ──────────────────────────────────────────────────────────

export function formatEth(wei: bigint | null | undefined): string {
  if (wei == null) return "0,0000";
  return parseFloat(ethers.formatEther(wei)).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTokenAmount(wei: bigint): string {
  return parseFloat(ethers.formatEther(wei)).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ETH_TX_HASH_RE  = /^0x[0-9a-fA-F]{64}$/;

export function sepoliaEtherscan(address: string, type: "address" | "tx" = "address"): string {
  const valid = type === "tx"
    ? ETH_TX_HASH_RE.test(address)
    : ETH_ADDRESS_RE.test(address);
  if (!valid) return "https://sepolia.etherscan.io";
  return `https://sepolia.etherscan.io/${type}/${address}`;
}

export function isValidCID(hash: string): boolean {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash) || /^baf[a-z2-7]{55,}$/i.test(hash);
}

export function ipfsGatewayUrl(hash: string): string {
  if (!isValidCID(hash)) return "#";
  return `https://ipfs.io/ipfs/${hash}`;
}

export function formatFiat(cents: bigint, currency: string): string | null {
  if (cents === 0n || !currency) return null;
  const amount = Number(cents) / 100;
  if (currency === "BRL") {
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function proposalStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case ProposalStatus.Active:   return "Em votação";
    case ProposalStatus.Executed: return "Aprovada";
    case ProposalStatus.Rejected: return "Rejeitada";
  }
}

export function proposalStatusColor(status: ProposalStatus): string {
  switch (status) {
    case ProposalStatus.Active:   return "bg-blue-500/15 text-blue-400";
    case ProposalStatus.Executed: return "bg-emerald-500/15 text-emerald-400";
    case ProposalStatus.Rejected: return "bg-red-500/15 text-red-400";
  }
}
