"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import {
  useWallet,
  usePools,
  usePoolExpenditures,
  useImpactReports,
  useProposals,
  useTokenBalance,
} from "@/lib/hooks";
import {
  getWriteContract,
  getAuditor,
  proposeAuditor,
  voteOnProposal,
  executeProposal,
  formatEth,
  formatDate,
  formatTokenAmount,
  isValidCID,
  shortAddress,
  sepoliaEtherscan,
  proposalStatusLabel,
  ProposalStatus,
  PREDEFINED_METRICS,
  GOVERNANCE_ADDRESS,
} from "@/lib/contract";
import {
  Plus,
  Receipt,
  Leaf,
  Settings,
  Users,
  Vote,
  Lock,
  Upload,
  Check,
  ExternalLink,
} from "@/components/Icons";
import AppHeader from "@/components/AppHeader";

const CATEGORIES = ["Meio Ambiente", "Educação", "Saúde", "ESG", "Social", "Cultura", "Outro"];
const CURRENCIES = ["BRL", "USD", "EUR"];

type GovSubmitting = "propose" | `vote-${string}` | `execute-${string}` | null;

type Section =
  | "criar-fundo"
  | "registrar-despesa"
  | "registrar-impacto"
  | "gerenciar"
  | "auditores"
  | "governanca";

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "criar-fundo", label: "Criar Fundo", icon: <Plus size={16} /> },
  { id: "registrar-despesa", label: "Registrar Despesa", icon: <Receipt size={16} /> },
  { id: "registrar-impacto", label: "Registrar Impacto", icon: <Leaf size={16} /> },
  { id: "gerenciar", label: "Gerenciar Fundos", icon: <Settings size={16} /> },
  { id: "auditores", label: "Auditores", icon: <Users size={16} /> },
  { id: "governanca", label: "Governança DAO", icon: <Vote size={16} /> },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export default function AdminPage() {
  const { address, isOwner, ownerLoading, loading: walletLoading, wrongNetwork, connect, disconnect, switchToSepolia, error: walletError } = useWallet();
  const { pools, refetch: refetchPools } = usePools();

  const [activeSection, setActiveSection] = useState<Section>("criar-fundo");

  const [poolForm, setPoolForm] = useState({ name: "", category: CATEGORIES[0], totalEth: "" });
  const [expForm, setExpForm] = useState({
    poolId: "",
    description: "",
    amountEth: "",
    fiatAmountBrl: "",
    fiatCurrency: "BRL",
    beneficiary: "",
    ipfsHash: "",
  });
  const [auditorAddress, setAuditorAddress] = useState("");
  const [currentAuditor, setCurrentAuditor] = useState<string | null>(null);
  const [impactForm, setImpactForm] = useState({
    poolId: "",
    expenditureId: "",
    beneficiariesCount: "",
    metric: "",
    metricValue: "",
    metricGoal: "",
    location: "",
  });
  const [metricIsCustom, setMetricIsCustom] = useState(false);
  const [submittingPool, setSubmittingPool] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingImpact, setSubmittingImpact] = useState(false);
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);
  const [submittingAuditor, setSubmittingAuditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
    txHash?: string;
  } | null>(null);

  const { proposals, refetch: refetchProposals } = useProposals();
  const { balance: tokenBalance, supply: tokenSupply } = useTokenBalance(address);
  const [govForm, setGovForm] = useState({ targetAuditor: "", description: "" });
  const [govSubmitting, setGovSubmitting] = useState<GovSubmitting>(null);
  const [govFeedback, setGovFeedback] = useState<{
    type: "success" | "error";
    msg: string;
    txHash?: string;
  } | null>(null);
  const [votedProposals, setVotedProposals] = useState<Set<string>>(new Set());

  const hasTokens = tokenBalance > 0n;
  const { expenditures: impactExpenditures } = usePoolExpenditures(
    impactForm.poolId ? Number(impactForm.poolId) : 0
  );
  const { reports: existingReports } = useImpactReports(impactExpenditures.map((e) => e.id));

  useEffect(() => {
    if (address && isOwner) {
      getAuditor().then(setCurrentAuditor).catch(() => {});
    }
  }, [address, isOwner]);

  const activePools = pools.filter((p) => p.active);
  const selectedExpPool = activePools.find((p) => p.id.toString() === expForm.poolId) ?? null;
  const availableEth = selectedExpPool ? selectedExpPool.totalAmount - selectedExpPool.spentAmount : null;

  function showFeedback(type: "success" | "error", msg: string, txHash?: string) {
    setFeedback({ type, msg, txHash });
    if (!txHash) setTimeout(() => setFeedback(null), 8000);
  }

  function contractErrorMsg(e: unknown): string {
    const reason = (e as { reason?: string })?.reason ?? "";
    const msg = (e as { message?: string })?.message ?? "";
    const full = [reason, msg, String(e)].join(" ");
    if (full.includes("user rejected") || full.includes("4001")) return "Transação cancelada";
    if (full.includes("ultrapassa")) return "Gasto ultrapassa o saldo disponível do fundo";
    if (full.includes("Fundo inativo")) return "Este fundo já foi encerrado";
    if (full.includes("recibos pendentes")) return "Não é possível encerrar: há gastos aguardando confirmação de recebimento.";
    if (full.includes("Fundo nao existe")) return "Fundo não encontrado";
    if (full.includes("Nome de fundo ja utilizado")) return "Já existe um fundo com este nome. Escolha um nome diferente.";
    if (full.includes("Beneficiario invalido")) return "Endereço do beneficiário inválido";
    if (full.includes("Descricao obrigatoria")) return "Descrição obrigatória";
    if (full.includes("Valor deve ser maior")) return "Valor deve ser maior que zero";
    if (full.includes("Impacto ja registrado")) return "Impacto já registrado para este gasto";
    if (full.includes("Fundo inativo")) return "Este fundo está encerrado — não é possível registrar impacto";
    if (full.includes("nao existe")) return "Registro não encontrado";
    if (full.includes("Informe ao menos")) return "Informe ao menos 1 beneficiado";
    if (full.includes("Auditor invalido")) return "Endereço de auditor inválido";
    if (full.includes("Sem tokens")) return "Você não tem tokens IMPACT para votar";
    if (full.includes("Ja votou")) return "Você já votou nesta proposta";
    if (full.includes("ainda ativa")) return "A votação ainda está em andamento";
    if (full.includes("Ja processada")) return "Esta proposta já foi finalizada";
    return "Erro na transação. Tente novamente.";
  }

  async function handleCreatePool(e: React.FormEvent) {
    e.preventDefault();
    if (/[<>"'`]/.test(poolForm.name)) {
      showFeedback("error", "Nome do fundo não pode conter caracteres HTML ( < > \" ' ` ).");
      return;
    }
    setSubmittingPool(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.createPool(poolForm.name, poolForm.category, ethers.parseEther(poolForm.totalEth));
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showFeedback("success", `Fundo "${poolForm.name}" criado com sucesso!`);
      setPoolForm({ name: "", category: CATEGORIES[0], totalEth: "" });
      refetchPools();
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingPool(false);
    }
  }

  async function handleRegisterExpenditure(e: React.FormEvent) {
    e.preventDefault();
    if (!ethers.isAddress(expForm.beneficiary)) {
      showFeedback("error", "Endereço do beneficiário inválido");
      return;
    }
    setSubmittingExpense(true);
    try {
      const fiatCents = expForm.fiatAmountBrl
        ? BigInt(Math.round(parseFloat(expForm.fiatAmountBrl) * 100))
        : 0n;
      const contract = await getWriteContract();
      const tx = await contract.registerExpenditure(
        Number(expForm.poolId),
        expForm.description,
        ethers.parseEther(expForm.amountEth),
        expForm.beneficiary,
        expForm.ipfsHash,
        fiatCents,
        expForm.fiatAmountBrl ? expForm.fiatCurrency : ""
      );
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showFeedback("success", "Gasto registrado com sucesso!");
      setExpForm({ poolId: "", description: "", amountEth: "", fiatAmountBrl: "", fiatCurrency: "BRL", beneficiary: "", ipfsHash: "" });
      refetchPools();
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingExpense(false);
    }
  }

  async function handleRegisterImpact(e: React.FormEvent) {
    e.preventDefault();
    const count = Number(impactForm.beneficiariesCount);
    if (!count || count < 1) {
      showFeedback("error", "Informe ao menos 1 beneficiado");
      return;
    }
    setSubmittingImpact(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.registerImpact(
        Number(impactForm.expenditureId),
        BigInt(count),
        impactForm.metric,
        impactForm.metricValue ? BigInt(Math.round(Number(impactForm.metricValue))) : 0n,
        impactForm.metricGoal ? BigInt(Math.round(Number(impactForm.metricGoal))) : 0n,
        impactForm.location
      );
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showFeedback("success", "Impacto registrado com sucesso!");
      setImpactForm({ poolId: "", expenditureId: "", beneficiariesCount: "", metric: "", metricValue: "", metricGoal: "", location: "" });
      setMetricIsCustom(false);
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingImpact(false);
    }
  }

  async function handleSetAuditor(e: React.FormEvent) {
    e.preventDefault();
    if (!ethers.isAddress(auditorAddress)) {
      showFeedback("error", "Endereço inválido");
      return;
    }
    setSubmittingAuditor(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.setAuditor(auditorAddress);
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      setCurrentAuditor(auditorAddress);
      setAuditorAddress("");
      showFeedback("success", "Auditor definido com sucesso.");
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingAuditor(false);
    }
  }

  async function handleRemoveAuditor() {
    setSubmittingAuditor(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.removeAuditor();
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      setCurrentAuditor(null);
      showFeedback("success", "Auditor removido.");
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingAuditor(false);
    }
  }

  function showGovFeedback(type: "success" | "error", msg: string, txHash?: string) {
    setGovFeedback({ type, msg, txHash });
    if (!txHash) setTimeout(() => setGovFeedback(null), 6000);
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    if (!ethers.isAddress(govForm.targetAuditor)) {
      showGovFeedback("error", "Endereço do candidato inválido");
      return;
    }
    setGovSubmitting("propose");
    try {
      const tx = await proposeAuditor(govForm.targetAuditor, govForm.description);
      showGovFeedback("success", "Proposta enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showGovFeedback("success", "Proposta criada! Votação aberta por 3 dias.");
      setGovForm({ targetAuditor: "", description: "" });
      refetchProposals();
    } catch (err) {
      showGovFeedback("error", contractErrorMsg(err));
    } finally {
      setGovSubmitting(null);
    }
  }

  async function handleVote(proposalId: bigint, support: boolean) {
    setGovSubmitting(`vote-${proposalId}`);
    try {
      const tx = await voteOnProposal(proposalId, support);
      showGovFeedback("success", "Voto enviado. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showGovFeedback("success", `Voto registrado: ${support ? "a favor" : "contra"}. Seus tokens permanecem na carteira.`);
      setVotedProposals((prev) => new Set(prev).add(proposalId.toString()));
      refetchProposals();
    } catch (err) {
      showGovFeedback("error", contractErrorMsg(err));
    } finally {
      setGovSubmitting(null);
    }
  }

  async function handleExecute(proposalId: bigint) {
    setGovSubmitting(`execute-${proposalId}`);
    try {
      const tx = await executeProposal(proposalId);
      showGovFeedback("success", "Execução enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showGovFeedback("success", "Proposta finalizada!");
      refetchProposals();
    } catch (err) {
      showGovFeedback("error", contractErrorMsg(err));
    } finally {
      setGovSubmitting(null);
    }
  }

  async function handleDeactivatePool(poolId: bigint, poolName: string) {
    setSubmittingDeactivate(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.deactivatePool(poolId);
      showFeedback("success", "Transação enviada. Aguardando confirmação...", tx.hash);
      await tx.wait();
      showFeedback("success", `Fundo "${poolName}" encerrado.`);
      refetchPools();
    } catch (err) {
      showFeedback("error", contractErrorMsg(err));
    } finally {
      setSubmittingDeactivate(false);
    }
  }

  async function handleEvidenceUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-evidence", { method: "POST", body: fd });
      const data = await res.json();
      if (data.cid) {
        setExpForm((prev) => ({ ...prev, ipfsHash: data.cid }));
        showFeedback("success", `Comprovante enviado ao IPFS! CID: ${data.cid}`);
      } else {
        showFeedback("error", data.error ?? "Erro ao fazer upload do comprovante.");
      }
    } catch {
      showFeedback("error", "Erro de conexão ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  // ── Render sections ──────────────────────────────────────────────────────

  function renderCriarFundo() {
    return (
      <div className="stack gap-20">
        <div>
          <h2 className="t-h3" style={{ marginBottom: "4px" }}>Criar Novo Fundo</h2>
          <p className="t-small">Aloque verba e defina categoria on-chain.</p>
        </div>
        <form onSubmit={handleCreatePool} className="stack gap-14">
          <Field label="Nome do Fundo">
            <input
              type="text"
              required
              className="input"
              value={poolForm.name}
              onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
              placeholder="ex: Projeto Reciclagem 2025"
            />
          </Field>
          <Field label="Categoria">
            <select
              className="select"
              value={poolForm.category}
              onChange={(e) => setPoolForm({ ...poolForm, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Total Alocado (ETH)">
            <input
              type="number"
              required
              min="0.000001"
              step="any"
              className="input"
              value={poolForm.totalEth}
              onChange={(e) => setPoolForm({ ...poolForm, totalEth: e.target.value })}
              placeholder="ex: 1.5"
            />
          </Field>
          <button
            type="submit"
            disabled={submittingPool || wrongNetwork}
            className="btn btn-primary btn-block"
          >
            {submittingPool ? "Aguardando confirmação..." : "Criar Fundo"}
          </button>
        </form>
      </div>
    );
  }

  function renderRegistrarDespesa() {
    return (
      <div className="stack gap-20">
        <div>
          <h2 className="t-h3" style={{ marginBottom: "4px" }}>Registrar Despesa</h2>
          <p className="t-small">Registre cada pagamento imutavelmente na blockchain.</p>
        </div>
        <form onSubmit={handleRegisterExpenditure} className="stack gap-14">
          <Field label="Fundo">
            <select
              required
              className="select"
              value={expForm.poolId}
              onChange={(e) => setExpForm({ ...expForm, poolId: e.target.value })}
            >
              <option value="">Selecione um fundo ativo</option>
              {activePools.map((p) => (
                <option key={p.id.toString()} value={p.id.toString()}>
                  #{p.id.toString()} — {p.name}
                </option>
              ))}
            </select>
            {selectedExpPool && availableEth !== null && (
              <div className="field-hint">
                Disponível:{" "}
                <strong className="mono">{formatEth(availableEth)} ETH</strong>
                <span style={{ color: "var(--muted)", marginLeft: "4px" }}>
                  de {formatEth(selectedExpPool.totalAmount)} ETH
                </span>
              </div>
            )}
          </Field>
          <Field label="Descrição">
            <input
              type="text"
              required
              className="input"
              value={expForm.description}
              onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
              placeholder="ex: Compra de mudas para reflorestamento"
            />
          </Field>
          <Field label="Valor (ETH)">
            <input
              type="number"
              required
              min="0.000001"
              step="any"
              className="input"
              max={availableEth !== null ? Number(ethers.formatEther(availableEth)) : undefined}
              value={expForm.amountEth}
              onChange={(e) => setExpForm({ ...expForm, amountEth: e.target.value })}
              placeholder="ex: 0.5"
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "10px" }}>
            <Field label="Valor fiat (opcional)">
              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={expForm.fiatAmountBrl}
                onChange={(e) => setExpForm({ ...expForm, fiatAmountBrl: e.target.value })}
                placeholder="ex: 9000.00"
              />
            </Field>
            <Field label="Moeda">
              <select
                className="select"
                value={expForm.fiatCurrency}
                onChange={(e) => setExpForm({ ...expForm, fiatCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Endereço do Beneficiário">
            <input
              type="text"
              required
              className="input input-mono"
              value={expForm.beneficiary}
              onChange={(e) => setExpForm({ ...expForm, beneficiary: e.target.value })}
              placeholder="0x..."
            />
          </Field>

          {/* Dropzone */}
          <Field
            label="Comprovante IPFS (opcional)"
            hint="PDF, imagem ou documento (máx. 4 MB). Hash gravado permanentemente no contrato."
          >
            {expForm.ipfsHash ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "var(--raised)",
                  borderRadius: "var(--r-10)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    flex: 1,
                    fontSize: "12px",
                    color: isValidCID(expForm.ipfsHash) ? "var(--accent)" : "var(--amber)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {expForm.ipfsHash}
                </span>
                <span
                  style={{ fontSize: "11px", color: isValidCID(expForm.ipfsHash) ? "var(--ok)" : "var(--amber)" }}
                >
                  {isValidCID(expForm.ipfsHash) ? "CID válido" : "Formato incomum"}
                </span>
                <button
                  type="button"
                  onClick={() => setExpForm((p) => ({ ...p, ipfsHash: "" }))}
                  className="btn btn-sm btn-ghost"
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                >
                  Remover
                </button>
              </div>
            ) : (
              <label
                className={`dropzone${dragOver ? " drag" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleEvidenceUpload(f);
                }}
              >
                <div className="stack gap-8" style={{ alignItems: "center" }}>
                  <Upload size={22} style={{ color: "var(--mid)" } as React.CSSProperties} />
                  <span style={{ fontSize: "13px" }}>
                    {uploading ? "Enviando para IPFS..." : "Arraste ou clique para fazer upload"}
                  </span>
                  <span className="t-small">ou cole o CID abaixo:</span>
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEvidenceUpload(f); e.target.value = ""; }}
                  style={{ display: "none" }}
                />
              </label>
            )}
            {!expForm.ipfsHash && (
              <input
                type="text"
                className="input input-mono"
                style={{ marginTop: "8px" }}
                value={expForm.ipfsHash}
                onChange={(e) => setExpForm({ ...expForm, ipfsHash: e.target.value })}
                placeholder="Cole o CID manualmente..."
              />
            )}
          </Field>

          <button
            type="submit"
            disabled={submittingExpense || activePools.length === 0 || wrongNetwork}
            className="btn btn-primary btn-block"
          >
            {submittingExpense ? "Aguardando confirmação..." : "Registrar Despesa"}
          </button>
        </form>
      </div>
    );
  }

  function renderRegistrarImpacto() {
    return (
      <div className="stack gap-20">
        <div>
          <h2 className="t-h3" style={{ marginBottom: "4px" }}>Registrar Impacto Concreto</h2>
          <p className="t-small">Documente beneficiados e métricas de impacto.</p>
        </div>
        <form onSubmit={handleRegisterImpact}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            <Field label="Fundo">
              <select
                required
                className="select"
                value={impactForm.poolId}
                onChange={(e) =>
                  setImpactForm({ ...impactForm, poolId: e.target.value, expenditureId: "" })
                }
              >
                <option value="">Selecione um fundo ativo</option>
                {activePools.map((p) => (
                  <option key={p.id.toString()} value={p.id.toString()}>
                    #{p.id.toString()} — {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Gasto">
              <select
                required
                className="select"
                value={impactForm.expenditureId}
                onChange={(e) =>
                  setImpactForm({ ...impactForm, expenditureId: e.target.value })
                }
                disabled={!impactForm.poolId || impactExpenditures.length === 0}
              >
                <option value="">Selecione um gasto</option>
                {impactExpenditures.map((exp) => {
                  const hasReport = !!existingReports[exp.id.toString()];
                  return (
                    <option
                      key={exp.id.toString()}
                      value={exp.id.toString()}
                      disabled={hasReport}
                    >
                      #{exp.id.toString()} — {exp.description}
                      {hasReport ? " (registrado)" : ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Beneficiados *">
              <input
                type="number"
                required
                min="1"
                step="1"
                className="input"
                value={impactForm.beneficiariesCount}
                onChange={(e) =>
                  setImpactForm({ ...impactForm, beneficiariesCount: e.target.value })
                }
                placeholder="ex: 150"
              />
            </Field>
            <Field label="Indicador (opcional)">
              <select
                className="select"
                value={metricIsCustom ? "Outro" : impactForm.metric}
                onChange={(e) => {
                  if (e.target.value === "Outro") {
                    setMetricIsCustom(true);
                    setImpactForm({ ...impactForm, metric: "" });
                  } else {
                    setMetricIsCustom(false);
                    setImpactForm({ ...impactForm, metric: e.target.value });
                  }
                }}
              >
                <option value="">— Sem indicador específico —</option>
                {PREDEFINED_METRICS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="Outro">Outro (escrever)</option>
              </select>
              {metricIsCustom && (
                <input
                  type="text"
                  className="input"
                  style={{ marginTop: "8px" }}
                  value={impactForm.metric}
                  onChange={(e) => setImpactForm({ ...impactForm, metric: e.target.value })}
                  placeholder="Descreva o indicador..."
                  autoFocus
                />
              )}
            </Field>
            <Field label="Qtd. atingida (opcional)">
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                value={impactForm.metricValue}
                onChange={(e) =>
                  setImpactForm({ ...impactForm, metricValue: e.target.value })
                }
                placeholder="ex: 2000"
              />
            </Field>
            <Field label="Meta (opcional)">
              <input
                type="number"
                min="0"
                step="1"
                className="input"
                value={impactForm.metricGoal}
                onChange={(e) => setImpactForm({ ...impactForm, metricGoal: e.target.value })}
                placeholder="ex: 2500"
              />
            </Field>
            <Field label="Localização (opcional)">
              <input
                type="text"
                className="input"
                value={impactForm.location}
                onChange={(e) => setImpactForm({ ...impactForm, location: e.target.value })}
                placeholder="ex: Zona Norte, São Paulo — SP"
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={submittingImpact || wrongNetwork || !impactForm.expenditureId}
            className="btn btn-primary btn-block"
          >
            {submittingImpact ? "Aguardando confirmação..." : "Registrar Impacto"}
          </button>
        </form>
      </div>
    );
  }

  function renderGerenciar() {
    if (pools.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
          Nenhum fundo criado ainda.
        </div>
      );
    }
    return (
      <div className="stack gap-20">
        <div>
          <h2 className="t-h3" style={{ marginBottom: "4px" }}>Gerenciar Fundos</h2>
          <p className="t-small">Encerre fundos ativos quando necessário.</p>
        </div>
        <div className="stack gap-8">
          {pools.map((pool) => (
            <div
              key={pool.id.toString()}
              className="row gap-12"
              style={{
                padding: "14px 16px",
                background: "var(--raised)",
                borderRadius: "var(--r-10)",
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--bright)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pool.name}
                </p>
                <p className="mono t-small" style={{ margin: 0, marginTop: "2px" }}>
                  {formatEth(pool.spentAmount)} / {formatEth(pool.totalAmount)} ETH
                  <span
                    style={{
                      marginLeft: "8px",
                      color: pool.active ? "var(--ok)" : "var(--muted)",
                    }}
                  >
                    {pool.active ? "Ativo" : "Encerrado"}
                  </span>
                </p>
              </div>
              {pool.active && (
                <button
                  onClick={() => handleDeactivatePool(pool.id, pool.name)}
                  disabled={submittingDeactivate || wrongNetwork}
                  className="btn btn-sm btn-danger-outline"
                  style={{ flexShrink: 0 }}
                >
                  {submittingDeactivate ? "..." : "Encerrar"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAuditores() {
    return (
      <div className="stack gap-20">
        <div>
          <h2 className="t-h3" style={{ marginBottom: "4px" }}>Auditor Independente</h2>
          <p className="t-small" style={{ lineHeight: 1.7 }}>
            Terceiro que valida gastos de forma independente adiciona uma segunda assinatura
            de accountability além da confirmação do beneficiário.
          </p>
        </div>

        {currentAuditor &&
          currentAuditor !== "0x0000000000000000000000000000000000000000" && (
            <div
              className="row gap-12"
              style={{
                padding: "14px 16px",
                background: "rgba(30,158,104,0.06)",
                border: "1px solid rgba(30,158,104,0.2)",
                borderRadius: "var(--r-10)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="kpi-label" style={{ marginBottom: "3px" }}>Auditor atual</div>
                <a
                  href={sepoliaEtherscan(currentAuditor)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mono"
                  style={{ fontSize: "12px", wordBreak: "break-all" }}
                >
                  {currentAuditor}
                </a>
              </div>
              <button
                onClick={handleRemoveAuditor}
                disabled={submittingAuditor || wrongNetwork}
                className="btn btn-sm btn-danger-outline"
                style={{ flexShrink: 0 }}
              >
                Remover
              </button>
            </div>
          )}

        <form onSubmit={handleSetAuditor} className="row gap-10">
          <input
            type="text"
            required
            className="input input-mono"
            style={{ flex: 1 }}
            value={auditorAddress}
            onChange={(e) => setAuditorAddress(e.target.value)}
            placeholder="0x... endereço do auditor"
          />
          <button
            type="submit"
            disabled={submittingAuditor || wrongNetwork}
            className="btn btn-primary"
            style={{ flexShrink: 0 }}
          >
            {submittingAuditor ? "Aguardando..." : "Definir Auditor"}
          </button>
        </form>
      </div>
    );
  }

  function renderGovernanca() {
    return (
      <div className="stack gap-20">
        <div className="row gap-12" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h2 className="t-h3" style={{ marginBottom: "4px" }}>Governança DAO</h2>
            <p className="t-small" style={{ lineHeight: 1.7 }}>
              Holders de IMPACT tokens podem propor e votar na eleição do auditor independente.
              {tokenSupply > 0n && (
                <span style={{ color: "var(--muted)" }}>
                  {" "}Supply total: {formatTokenAmount(tokenSupply)} IMPACT.
                </span>
              )}
            </p>
            <p className="t-small" style={{ marginTop: "6px", color: "var(--ok)", lineHeight: 1.6 }}>
              Seus tokens <strong>não são gastos</strong> ao votar eles definem apenas o peso do voto.
            </p>
          </div>
          {tokenBalance > 0n && (
            <span
              className="badge badge-ok"
              title="Tokens são peso de voto — não são gastos ao votar"
            >
              {formatTokenAmount(tokenBalance)} IMPACT
            </span>
          )}
        </div>

        {govFeedback && (
          <div
            className={govFeedback.type === "success" ? "feedback-ok" : "feedback-err"}
          >
            <span>{govFeedback.msg}</span>
            {govFeedback.txHash && (
              <a
                href={sepoliaEtherscan(govFeedback.txHash, "tx")}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
                style={{ fontSize: "13px" }}
              >
                Ver transação
              </a>
            )}
          </div>
        )}

        <div
          className="dao-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}
        >
          {/* Criar proposta */}
          <div>
            <div className="eyebrow" style={{ marginBottom: "14px" }}>Nova Proposta</div>
            {!hasTokens ? (
              <div
                className="card"
                style={{
                  padding: "20px",
                  background: "var(--raised)",
                  border: "none",
                  fontSize: "13px",
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                Você precisa de IMPACT tokens para criar propostas. Os tokens são emitidos
                automaticamente quando você confirma o recebimento de um gasto como beneficiário.
              </div>
            ) : (
              <form onSubmit={handlePropose} className="stack gap-12">
                <Field label="Endereço do candidato a auditor">
                  <input
                    type="text"
                    required
                    className="input input-mono"
                    value={govForm.targetAuditor}
                    onChange={(e) => setGovForm({ ...govForm, targetAuditor: e.target.value })}
                    placeholder="0x..."
                  />
                </Field>
                <Field label="Justificativa">
                  <textarea
                    required
                    rows={3}
                    className="textarea"
                    value={govForm.description}
                    onChange={(e) => setGovForm({ ...govForm, description: e.target.value })}
                    placeholder="ex: Empresa XYZ — auditora ESG certificada pelo INMETRO"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={govSubmitting === "propose" || wrongNetwork}
                  className="btn btn-primary btn-block"
                >
                  {govSubmitting === "propose" ? "Aguardando confirmação..." : "Criar Proposta"}
                </button>
              </form>
            )}
          </div>

          {/* Propostas */}
          <div>
            <div
              className="row gap-10"
              style={{ justifyContent: "space-between", marginBottom: "14px" }}
            >
              <div className="eyebrow">
                Propostas
                {proposals.length > 0 && (
                  <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: "6px" }}>
                    ({proposals.length})
                  </span>
                )}
              </div>
              <button onClick={refetchProposals} className="btn btn-ghost btn-sm">
                Atualizar
              </button>
            </div>
            {proposals.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                Nenhuma proposta criada ainda.
              </div>
            ) : (
              <div
                className="stack gap-10"
                style={{ maxHeight: "440px", overflowY: "auto" }}
              >
                {[...proposals].reverse().map((p) => {
                  const total = p.votesFor + p.votesAgainst;
                  const forPct = total > 0n ? Number((p.votesFor * 100n) / total) : 0;
                  const deadline = new Date(Number(p.deadline) * 1000);
                  const isActive = p.status === ProposalStatus.Active;
                  const isPast = Date.now() > deadline.getTime();
                  const alreadyVoted = votedProposals.has(p.id.toString());
                  const canVote = isActive && !isPast && hasTokens && !alreadyVoted;
                  const canExec = isActive;

                  let statusBadgeClass = "badge-val";
                  if (p.status === ProposalStatus.Executed) statusBadgeClass = "badge-ok";
                  else if (p.status === ProposalStatus.Rejected) statusBadgeClass = "badge-closed";

                  return (
                    <div
                      key={p.id.toString()}
                      style={{
                        background: "var(--raised)",
                        borderRadius: "var(--r-10)",
                        padding: "14px 16px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="row gap-8"
                        style={{ justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap" }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--bright)",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.description}
                          </p>
                          <p className="mono t-small" style={{ margin: 0, marginTop: "2px" }}>
                            Candidato:{" "}
                            <a
                              href={sepoliaEtherscan(p.targetAuditor)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-accent"
                              style={{ fontSize: "11px" }}
                            >
                              {shortAddress(p.targetAuditor)}
                            </a>
                          </p>
                        </div>
                        <span className={`badge ${statusBadgeClass}`} style={{ flexShrink: 0 }}>
                          {proposalStatusLabel(p.status)}
                        </span>
                      </div>

                      {total > 0n && (
                        <div style={{ marginBottom: "8px" }}>
                          <div
                            className="row gap-4"
                            style={{ justifyContent: "space-between", marginBottom: "4px" }}
                          >
                            <span style={{ fontSize: "11px", color: "var(--ok)" }}>
                              {formatTokenAmount(p.votesFor)} a favor
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--amber)" }}>
                              {formatTokenAmount(p.votesAgainst)} contra
                            </span>
                          </div>
                          <div className="track" style={{ height: "4px" }}>
                            <div className="fill" style={{ width: `${forPct}%` }} />
                          </div>
                        </div>
                      )}

                      <div
                        className="row gap-6"
                        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
                      >
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                          {isActive
                            ? isPast
                              ? "Prazo encerrado aguardando execução"
                              : `Encerra ${formatDate(p.deadline)}`
                            : p.status === ProposalStatus.Executed
                            ? "Auditor atualizado no protocolo"
                            : "Proposta não aprovada"}
                        </p>
                        <div className="row gap-6">
                          {alreadyVoted ? (
                            <span className="badge badge-ok" style={{ fontSize: "11px" }}>
                              <Check size={10} />
                              Votado
                            </span>
                          ) : canVote ? (
                            <>
                              <button
                                onClick={() => handleVote(p.id, true)}
                                disabled={govSubmitting === `vote-${p.id}` || wrongNetwork}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: "11px", color: "var(--ok)", borderColor: "rgba(30,158,104,0.4)" }}
                              >
                                {govSubmitting === `vote-${p.id}` ? "..." : "A favor"}
                              </button>
                              <button
                                onClick={() => handleVote(p.id, false)}
                                disabled={govSubmitting === `vote-${p.id}` || wrongNetwork}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: "11px", color: "var(--amber)", borderColor: "rgba(201,114,28,0.4)" }}
                              >
                                {govSubmitting === `vote-${p.id}` ? "..." : "Contra"}
                              </button>
                            </>
                          ) : null}
                          {canExec && (
                            <button
                              onClick={() => handleExecute(p.id)}
                              disabled={govSubmitting === `execute-${p.id}` || wrongNetwork}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: "11px" }}
                            >
                              {govSubmitting === `execute-${p.id}`
                                ? "..."
                                : isPast
                                ? "Finalizar"
                                : "Finalizar"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sectionContent: Record<Section, () => React.ReactNode> = {
    "criar-fundo": renderCriarFundo,
    "registrar-despesa": renderRegistrarDespesa,
    "registrar-impacto": renderRegistrarImpacto,
    gerenciar: renderGerenciar,
    auditores: renderAuditores,
    governanca: renderGovernanca,
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--base)" }}>
      <AppHeader active="admin" />

      <div className="wrap" style={{ paddingTop: "32px", paddingBottom: "56px" }}>
        {/* Global feedback */}
        {walletError && (
          <div className="feedback-err" style={{ marginBottom: "16px" }}>
            {walletError}
          </div>
        )}
        {wrongNetwork && (
          <div className="feedback-err row gap-12" style={{ marginBottom: "16px" }}>
            <span>Rede incorreta. Você precisa estar na <strong>Sepolia</strong> para enviar transações.</span>
            <button onClick={switchToSepolia} className="btn btn-sm btn-danger-outline" style={{ flexShrink: 0 }}>
              Trocar para Sepolia
            </button>
          </div>
        )}
        {feedback && (
          <div
            className={feedback.type === "success" ? "feedback-ok" : "feedback-err"}
            style={{ marginBottom: "16px" }}
          >
            <span>{feedback.msg}</span>
            {feedback.txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${feedback.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link row gap-4"
                style={{ fontSize: "13px" }}
              >
                <ExternalLink size={13} />
                Ver transação
              </a>
            )}
          </div>
        )}

        {/* Not connected */}
        {!address && !walletLoading && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              maxWidth: "400px",
              margin: "0 auto",
            }}
          >
            <div
              className="icon-circle"
              style={{ width: "56px", height: "56px", margin: "0 auto 20px", background: "rgba(76,106,114,0.10)" }}
            >
              <Lock size={24} style={{ color: "var(--muted)" } as React.CSSProperties} />
            </div>
            <h2 className="t-h3" style={{ marginBottom: "8px" }}>Conecte sua carteira</h2>
            <p className="t-body" style={{ color: "var(--muted)", marginBottom: "24px" }}>
              Apenas o owner do contrato pode criar fundos e registrar gastos.
            </p>
            <button onClick={connect} disabled={walletLoading} className="btn btn-primary">
              {walletLoading ? "Conectando..." : "Conectar MetaMask"}
            </button>
          </div>
        )}

        {/* Connected but not owner */}
        {address && !isOwner && !ownerLoading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)" }}>
            <div
              className="icon-circle"
              style={{ width: "56px", height: "56px", margin: "0 auto 16px", background: "rgba(201,114,28,0.10)" }}
            >
              <Lock size={24} style={{ color: "var(--amber)" } as React.CSSProperties} />
            </div>
            <h2 className="t-h3" style={{ color: "var(--amber)", marginBottom: "8px" }}>
              Acesso Restrito
            </h2>
            <p className="t-small" style={{ marginBottom: "12px" }}>
              Sua carteira não é o owner deste contrato.
            </p>
            <p className="t-small" style={{ marginBottom: "12px", fontFamily: "monospace", wordBreak: "break-all" }}>
              Conectado: {address}
            </p>
            {hasTokens && (
              <p className="t-small" style={{ color: "var(--accent)" }}>
                Você tem {formatTokenAmount(tokenBalance)} IMPACT veja a seção Governança abaixo.
              </p>
            )}
          </div>
        )}

        {/* Owner loading check */}
        {address && ownerLoading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="skel" style={{ height: "20px", width: "160px", margin: "0 auto" }} />
          </div>
        )}

        {/* Owner logged in */}
        {address && isOwner && !ownerLoading && (
          <div
            className="admin-layout grid"
            style={{ display: "grid", gap: "28px", alignItems: "start" }}
          >
            {/* Sidebar */}
            <div
              className="admin-side card"
              style={{ padding: "12px", position: "sticky", top: "80px" }}
            >
              <div className="eyebrow" style={{ padding: "8px 12px 12px", marginBottom: "4px" }}>
                Painel Admin
              </div>
              {NAV.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="admin-navitem row gap-10"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: activeSection === item.id ? "var(--raised)" : "transparent",
                    color: activeSection === item.id ? "var(--bright)" : "var(--mid)",
                    fontWeight: activeSection === item.id ? 600 : 400,
                    border: "none",
                  }}
                >
                  <span
                    style={{
                      color: activeSection === item.id ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="card card-pad-lg" style={{ minWidth: 0 }}>
              {sectionContent[activeSection]()}
            </div>
          </div>
        )}

        {/* Governance for non-owners with tokens */}
        {address && !isOwner && hasTokens && GOVERNANCE_ADDRESS && (
          <div className="card card-pad-lg" style={{ marginTop: "24px" }}>
            {renderGovernanca()}
          </div>
        )}
      </div>
    </main>
  );
}
