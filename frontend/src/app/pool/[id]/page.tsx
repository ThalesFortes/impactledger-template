"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { usePoolExpenditures, useWallet, useImpactReports } from "@/lib/hooks";
import {
  getPool,
  getWriteContract,
  getAuditor,
  isAuditValidated,
  isRejected,
  FundPool,
  formatEth,
  formatFiat,
  formatDate,
  shortAddress,
  sepoliaEtherscan,
  ipfsGatewayUrl,
  CATEGORY_ODS,
} from "@/lib/contract";
import SpendingTimeline from "@/components/SpendingTimeline";
import { ExternalLink, Award, Check, Link2, FileText } from "@/components/Icons";
import AppHeader from "@/components/AppHeader";

// ── Progress ─────────────────────────────────────────────────────────────────
function Progress({ percent, lg = false }: { percent: number; lg?: boolean }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(percent), 80);
    return () => clearTimeout(t);
  }, [percent]);
  return (
    <div className={`track${lg ? " track-lg" : ""}`}>
      <div className="fill" style={{ width: `${w}%` }} />
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────
function ConfirmModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="t-h3" style={{ marginBottom: "12px" }}>
          Confirmar recebimento
        </h3>
        <p className="t-body" style={{ marginBottom: "24px", color: "var(--muted)" }}>
          Ao confirmar, você assina criptograficamente que recebeu este valor. Um NFT de certificado
          será emitido automaticamente na blockchain.
        </p>
        <div className="row gap-10">
          <button onClick={onCancel} className="btn btn-ghost" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
            {loading ? "Aguardando..." : "Confirmar recebimento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RejectModal ───────────────────────────────────────────────────────────────
function RejectModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="t-h3" style={{ marginBottom: "12px" }}>
          Rejeitar gasto
        </h3>
        <p className="t-body" style={{ marginBottom: "12px", color: "var(--muted)" }}>
          Ao rejeitar, você registra <strong style={{ color: "var(--bright)" }}>on-chain e de forma permanente</strong> que este
          gasto é indevido, falso ou não corresponde ao que você recebeu.
        </p>
        <p className="t-small" style={{ marginBottom: "24px", color: "var(--amber)" }}>
          Esta ação é irreversível e ficará pública para qualquer auditor ou doador verificar no Etherscan.
        </p>
        <div className="row gap-10">
          <button onClick={onCancel} className="btn btn-ghost" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-danger-outline" style={{ flex: 1 }}>
            {loading ? "Aguardando..." : "Rejeitar gasto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const poolId = Number(id);

  const [pool, setPool] = useState<FundPool | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const { expenditures, loading: expLoading, refetch } = usePoolExpenditures(poolId);
  const { reports: impactReports } = useImpactReports(expenditures.map((e) => e.id));
  const { address, isOwner, loading: walletLoading, wrongNetwork, connect, switchToSepolia } = useWallet();
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingPool, setClosingPool] = useState(false);
  const [confirmExp, setConfirmExp] = useState<bigint | null>(null);
  const [confirmingId, setConfirmingId] = useState<bigint | null>(null);
  const [rejectExp, setRejectExp] = useState<bigint | null>(null);
  const [rejectingId, setRejectingId] = useState<bigint | null>(null);
  const [validatingId, setValidatingId] = useState<bigint | null>(null);
  const [auditorAddress, setAuditorAddress] = useState<string | null>(null);
  const [auditMap, setAuditMap] = useState<Record<string, boolean>>({});
  const [rejectMap, setRejectMap] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error"; txHash?: string } | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    getPool(poolId)
      .then(setPool)
      .catch(() => setPool(null))
      .finally(() => setPoolLoading(false));
    getAuditor().then(setAuditorAddress).catch(() => {});
  }, [poolId]);

  useEffect(() => {
    if (expenditures.length === 0) return;
    Promise.all(
      expenditures.map((e) =>
        isAuditValidated(e.id).then((v) => [e.id.toString(), v] as const)
      )
    )
      .then((entries) => setAuditMap(Object.fromEntries(entries)))
      .catch(() => {});
    Promise.all(
      expenditures.map((e) =>
        isRejected(e.id).then((v) => [e.id.toString(), v] as const)
      )
    )
      .then((entries) => setRejectMap(Object.fromEntries(entries)))
      .catch(() => {});
  }, [expenditures]);

  function parseContractError(e: unknown): string {
    const msg = [
      (e as { reason?: string })?.reason,
      (e as { message?: string })?.message,
      String(e),
    ]
      .filter(Boolean)
      .join(" ");
    if (msg.includes("Aguardando validacao")) return "Este gasto ainda não foi validado pelo auditor.";
    if (msg.includes("Ja confirmado")) return "Este recebimento já foi confirmado anteriormente.";
    if (msg.includes("Apenas o beneficiario")) return "Apenas o beneficiário registrado pode confirmar ou rejeitar.";
    if (msg.includes("Ja rejeitado")) return "Este gasto já foi rejeitado anteriormente.";
    if (msg.includes("rejeitado pelo beneficiario")) return "Este gasto foi rejeitado pelo beneficiário.";
    if (msg.includes("rejected") || msg.includes("denied") || msg.includes("4001") || msg.includes("user rejected"))
      return "Transação cancelada pelo usuário.";
    if (msg.includes("Apenas o auditor")) return "Apenas o auditor designado pode validar.";
    if (msg.includes("Ja validado")) return "Este gasto já foi validado pelo auditor.";
    if (msg.includes("recibos pendentes")) return "Não é possível encerrar: há gastos aguardando confirmação de recebimento.";
    return "Erro na transação. Tente novamente.";
  }

  async function handleClosePool() {
    if (!pool) return;
    setShowCloseModal(false);
    setClosingPool(true);
    try {
      const contract = await getWriteContract();
      const tx = await contract.deactivatePool(pool.id);
      setFeedback({ msg: "Transação enviada. Aguardando confirmação...", type: "success", txHash: tx.hash });
      await tx.wait();
      setFeedback({ msg: `Fundo "${pool.name}" encerrado com sucesso.`, type: "success" });
      getPool(poolId).then(setPool).catch(() => {});
    } catch (e) {
      setFeedback({ msg: parseContractError(e), type: "error" });
    } finally {
      setClosingPool(false);
      setTimeout(() => setFeedback(null), 8000);
    }
  }

  async function handleConfirm(expenditureId: bigint) {
    setConfirmExp(null);
    setConfirmingId(expenditureId);
    try {
      const contract = await getWriteContract();
      const tx = await contract.confirmReceipt(expenditureId);
      setFeedback({ msg: "Transação enviada. Aguardando confirmação...", type: "success", txHash: tx.hash });
      await tx.wait();
      setFeedback({ msg: "Recebimento confirmado na blockchain!", type: "success" });
      refetch();
    } catch (e) {
      setFeedback({ msg: parseContractError(e), type: "error" });
    } finally {
      setConfirmingId(null);
      setTimeout(() => setFeedback(null), 8000);
    }
  }

  async function handleReject(expenditureId: bigint) {
    setRejectExp(null);
    setRejectingId(expenditureId);
    try {
      const contract = await getWriteContract();
      const tx = await contract.rejectReceipt(expenditureId);
      setFeedback({ msg: "Transação enviada. Aguardando confirmação...", type: "success", txHash: tx.hash });
      await tx.wait();
      setRejectMap((prev) => ({ ...prev, [expenditureId.toString()]: true }));
      setFeedback({ msg: "Rejeição registrada na blockchain. O gasto está marcado como denunciado.", type: "success" });
      refetch();
    } catch (e) {
      setFeedback({ msg: parseContractError(e), type: "error" });
    } finally {
      setRejectingId(null);
      setTimeout(() => setFeedback(null), 8000);
    }
  }

  async function handleAuditValidate(expenditureId: bigint) {
    setValidatingId(expenditureId);
    try {
      const contract = await getWriteContract();
      const tx = await contract.validateExpenditure(expenditureId);
      setFeedback({ msg: "Transação enviada. Aguardando confirmação...", type: "success", txHash: tx.hash });
      await tx.wait();
      setAuditMap((prev) => ({ ...prev, [expenditureId.toString()]: true }));
      setFeedback({ msg: "Gasto validado pelo auditor!", type: "success" });
    } catch (e) {
      setFeedback({ msg: parseContractError(e), type: "error" });
    } finally {
      setValidatingId(null);
      setTimeout(() => setFeedback(null), 8000);
    }
  }

  const percent =
    pool && pool.totalAmount > 0n
      ? Number((pool.spentAmount * 100n) / pool.totalAmount)
      : 0;
  const isAuditor =
    address &&
    auditorAddress &&
    address.toLowerCase() === auditorAddress.toLowerCase();

  const ods = pool ? CATEGORY_ODS[pool.category] : null;
  const pageStart = page * PAGE_SIZE;
  const pageRows = expenditures.slice(pageStart, pageStart + PAGE_SIZE);
  const totalPages = Math.ceil(expenditures.length / PAGE_SIZE);

  return (
    <main style={{ minHeight: "100vh", background: "var(--base)" }}>
      <AppHeader active="pool" backHref="/fundos/ativos" backLabel="Fundos" />

      <div className="wrap" style={{ paddingTop: "32px", paddingBottom: "56px" }}>
        {/* Feedback */}
        {feedback && (
          <div
            className={feedback.type === "success" ? "feedback-ok" : "feedback-err"}
            style={{ marginBottom: "20px" }}
          >
            <span>{feedback.msg}</span>
            {feedback.txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${feedback.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
                style={{ fontSize: "13px", whiteSpace: "nowrap" }}
              >
                Ver transação
              </a>
            )}
          </div>
        )}

        {/* Fund header card */}
        {poolLoading ? (
          <div className="skel" style={{ height: "160px", marginBottom: "24px" }} />
        ) : !pool ? (
          <div style={{ textAlign: "center", padding: "56px", color: "var(--muted)" }}>
            Fundo não encontrado.
          </div>
        ) : (
          <div className="card card-pad-lg enter" style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <div style={{ flex: 1 }}>
                {/* Category pill + status */}
                <div className="row gap-8" style={{ marginBottom: "12px", flexWrap: "wrap" }}>
                  <span
                    className="pill"
                    style={{
                      background: "rgba(19,128,196,0.10)",
                      color: "var(--accent)",
                      border: "1px solid rgba(19,128,196,0.25)",
                    }}
                  >
                    {pool.category}
                  </span>
                  {pool.active ? (
                    <span className="row gap-6 t-small">
                      <span className="status-dot dot-active" />
                      Ativo
                    </span>
                  ) : (
                    <span className="badge badge-closed">Encerrado</span>
                  )}
                </div>

                <h2 className="t-h2" style={{ marginBottom: "8px" }}>{pool.name}</h2>

                <div className="row gap-12 t-small" style={{ flexWrap: "wrap", marginBottom: "12px" }}>
                  <span>Criado em {formatDate(pool.createdAt)}</span>
                  {auditorAddress &&
                    auditorAddress !== "0x0000000000000000000000000000000000000000" && (
                      <span>
                        Auditor:{" "}
                        <a
                          href={sepoliaEtherscan(auditorAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link mono"
                          style={{ fontSize: "12px" }}
                        >
                          {shortAddress(auditorAddress)}
                        </a>
                      </span>
                    )}
                </div>

                {/* ODS badges */}
                {ods && (
                  <div className="row gap-6" style={{ flexWrap: "wrap", marginBottom: "12px" }}>
                    {ods.ids.map((id) => (
                      <span key={id} className="tag">ODS {id}</span>
                    ))}
                    <span className="t-small" style={{ color: "var(--muted)" }}>{ods.label}</span>
                  </div>
                )}
              </div>

              <div className="stack gap-8" style={{ flexShrink: 0, alignItems: "flex-end" }}>
                <span className="badge badge-val">
                  <Check size={11} />
                  On-chain
                </span>
                <a
                  href={sepoliaEtherscan(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link t-small row gap-4"
                >
                  <ExternalLink size={13} />
                  Ver contrato
                </a>
                {isOwner && pool.active && (() => {
                  const pendingCount = expenditures.filter(e => !e.confirmedByBeneficiary).length;
                  return (
                    <button
                      onClick={() => setShowCloseModal(true)}
                      disabled={closingPool || wrongNetwork || pendingCount > 0}
                      className="btn btn-sm btn-danger-outline"
                      title={pendingCount > 0 ? `${pendingCount} gasto(s) aguardando confirmação de recebimento` : undefined}
                    >
                      {closingPool ? "Encerrando..." : "Encerrar Fundo"}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* track-lg progress */}
            <div style={{ marginBottom: "8px" }}>
              <div
                className="row gap-10"
                style={{ justifyContent: "space-between", marginBottom: "8px" }}
              >
                <span className="t-small">Progresso de gastos</span>
                <span className="mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--bright)" }}>
                  {percent}%
                </span>
              </div>
              <Progress percent={percent} lg />
              <div
                className="row gap-10"
                style={{ justifyContent: "space-between", marginTop: "6px" }}
              >
                <span className="mono" style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>
                  {formatEth(pool.spentAmount)} ETH gastos
                </span>
                <span className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {formatEth(pool.totalAmount)} ETH alocados
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Impact summary */}
        {(() => {
          const reportList = Object.values(impactReports);
          if (reportList.length === 0) return null;

          const totalBenef = reportList.reduce((acc, r) => acc + r.beneficiariesCount, 0n);
          const metricGroups = new Map<string, { value: bigint; goal: bigint }>();
          for (const r of reportList) {
            if (!r.metric || r.metricValue === 0n) continue;
            const prev = metricGroups.get(r.metric) ?? { value: 0n, goal: 0n };
            metricGroups.set(r.metric, { value: prev.value + r.metricValue, goal: prev.goal + r.metricGoal });
          }
          const locations = [...new Set(reportList.filter((r) => r.location).map((r) => r.location))];

          return (
            <div
              className="card"
              style={{
                padding: "24px",
                marginBottom: "24px",
                borderColor: "rgba(30,158,104,0.3)",
                background: "rgba(30,158,104,0.04)",
              }}
            >
                <div className="eyebrow" style={{ color: "var(--ok)", marginBottom: "16px" }}>
                  Impacto do Fundo
                </div>
                <div
                  className="impact-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "16px",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <div className="kpi-label" style={{ marginBottom: "4px" }}>Pessoas beneficiadas</div>
                    <div className="kpi" style={{ fontSize: "26px", color: "var(--ok)" }}>
                      {Number(totalBenef).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {[...metricGroups.entries()].map(([label, { value, goal }]) => {
                    const pct = goal > 0n ? Math.min(Number((value * 100n) / goal), 100) : 0;
                    return (
                      <div key={label}>
                        {/* Label do indicador */}
                        <div className="kpi-label" style={{ marginBottom: "6px" }}>{label}</div>

                        {/* Valor atual */}
                        <div className="kpi" style={{ fontSize: "22px", marginBottom: goal > 0n ? "10px" : "0" }}>
                          {Number(value).toLocaleString("pt-BR")}
                        </div>

                        {goal > 0n && (
                          <>
                            {/* Barra de progresso */}
                            <div className="track" style={{ marginBottom: "6px" }}>
                              <div className="fill" style={{ width: `${pct}%` }} />
                            </div>

                            {/* Legenda: atual / meta + % */}
                            <div className="row gap-6" style={{ justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                                <span style={{ color: "var(--ok)", fontWeight: 600 }}>
                                  {Number(value).toLocaleString("pt-BR")}
                                </span>
                                {" "}
                                <span style={{ color: "var(--muted)" }}>
                                  / meta {Number(goal).toLocaleString("pt-BR")}
                                </span>
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: pct >= 100 ? "var(--ok)" : pct >= 75 ? "var(--accent)" : "var(--muted)",
                                  fontFamily: "var(--font-geist-mono)",
                                }}
                              >
                                {pct}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                {locations.length > 0 && (
                  <div className="row gap-6" style={{ flexWrap: "wrap" }}>
                    {locations.map((loc) => (
                      <span key={loc} className="tag">{loc}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        {/* Bar chart timeline */}
        {!expLoading && expenditures.length > 0 && (
          <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
            <div className="eyebrow" style={{ marginBottom: "16px" }}>Ritmo de gastos</div>
            <SpendingTimeline expenditures={expenditures} />
          </div>
        )}

        {/* Expense table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            className="row gap-12"
            style={{ justifyContent: "space-between", padding: "20px 20px 16px", flexWrap: "wrap" }}
          >
            <div className="eyebrow">Histórico de Gastos</div>
            <span className="t-small row gap-8">
              <a
                href={sepoliaEtherscan(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "")}
                target="_blank"
                rel="noopener noreferrer"
                className="badge badge-val row gap-6"
                style={{ textDecoration: "none", cursor: "pointer" }}
                title="Ver contrato no Etherscan"
              >
                <Link2 size={11} />
                dados on-chain
              </a>
              <span
                className="badge badge-closed row gap-6"
                title="Comprovantes armazenados no IPFS — clique em 'Ver comprovante' em cada linha"
              >
                <FileText size={11} />
                evidência IPFS
              </span>
            </span>
          </div>

          {expLoading ? (
            <div className="stack gap-8" style={{ padding: "0 20px 20px" }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skel" style={{ height: "64px" }} />
              ))}
            </div>
          ) : expenditures.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "var(--muted)",
                fontSize: "14px",
                borderTop: "1px solid var(--border)",
              }}
            >
              Nenhum gasto registrado neste fundo.
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                      <th>Beneficiário</th>
                      <th>Data</th>
                      <th>Status</th>
                      <th>Impacto</th>
                      <th>Cert.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((exp) => {
                      const isExpRejected = !!rejectMap[exp.id.toString()];
                      const canConfirm =
                        address &&
                        !exp.confirmedByBeneficiary &&
                        !isExpRejected &&
                        exp.beneficiary.toLowerCase() === address.toLowerCase();
                      const auditorSet =
                        auditorAddress &&
                        auditorAddress !== "0x0000000000000000000000000000000000000000";
                      const waitingAudit = canConfirm && auditorSet && !auditMap[exp.id.toString()];

                      return (
                        <tr key={exp.id.toString()}>
                          <td>
                            <span className="mono t-small" style={{ color: "var(--muted)" }}>
                              {exp.id.toString()}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: "13px", color: "var(--ghost)", marginBottom: "2px" }}>
                              {exp.description}
                            </div>
                            {exp.ipfsHash && (
                              <a
                                href={ipfsGatewayUrl(exp.ipfsHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="badge badge-closed row gap-6"
                                style={{ textDecoration: "none", marginTop: "4px", display: "inline-flex" }}
                                title={`CID: ${exp.ipfsHash}`}
                              >
                                <FileText size={11} />
                                Ver comprovante
                              </a>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <div className="mono" style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
                              {formatEth(exp.amount)} ETH
                            </div>
                            {formatFiat(exp.fiatAmountCents, exp.fiatCurrency) && (
                              <div className="t-small">{formatFiat(exp.fiatAmountCents, exp.fiatCurrency)}</div>
                            )}
                          </td>
                          <td>
                            <a
                              href={sepoliaEtherscan(exp.beneficiary)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link mono"
                              style={{ fontSize: "12px" }}
                            >
                              {shortAddress(exp.beneficiary)}
                            </a>
                          </td>
                          <td className="t-small" style={{ whiteSpace: "nowrap" }}>
                            {formatDate(exp.timestamp)}
                          </td>
                          <td>
                            <div className="stack gap-6">
                              {exp.confirmedByBeneficiary ? (
                                <>
                                  <span className="badge badge-ok">
                                    <Check size={11} />
                                    Confirmado
                                  </span>
                                  <span className="t-small">{formatDate(exp.confirmedAt)}</span>
                                </>
                              ) : isExpRejected ? (
                                <span className="badge badge-err" title="Beneficiário rejeitou este gasto on-chain">
                                  Rejeitado
                                </span>
                              ) : waitingAudit ? (
                                <span className="badge badge-pend">Aguardando auditor</span>
                              ) : canConfirm ? (
                                <div className="stack gap-4">
                                  <button
                                    onClick={() => setConfirmExp(exp.id)}
                                    disabled={confirmingId === exp.id || rejectingId === exp.id}
                                    className="btn btn-primary btn-sm"
                                  >
                                    {confirmingId === exp.id ? "..." : "Confirmar"}
                                  </button>
                                  <button
                                    onClick={() => setRejectExp(exp.id)}
                                    disabled={confirmingId === exp.id || rejectingId === exp.id}
                                    className="btn btn-danger-outline btn-sm"
                                  >
                                    {rejectingId === exp.id ? "..." : "Rejeitar"}
                                  </button>
                                </div>
                              ) : (
                                <span className="badge badge-pend pulse-ring">Aguardando</span>
                              )}
                              {auditMap[exp.id.toString()] ? (
                                <span className="badge badge-ok">
                                  <Check size={11} />
                                  Auditado
                                </span>
                              ) : isAuditor ? (
                                <button
                                  onClick={() => handleAuditValidate(exp.id)}
                                  disabled={validatingId === exp.id}
                                  className="btn btn-ghost btn-sm"
                                >
                                  {validatingId === exp.id ? "..." : "Validar"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            {(() => {
                              const r = impactReports[exp.id.toString()];
                              if (!r)
                                return <span style={{ color: "var(--border)", fontSize: "12px" }}>—</span>;
                              return (
                                <div className="stack gap-2">
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ok)" }}>
                                    {r.beneficiariesCount.toLocaleString("pt-BR")} benef.
                                  </span>
                                  {r.metric && r.metricValue > 0n && (
                                    <span className="t-small">
                                      {r.metricValue.toLocaleString("pt-BR")}
                                      {r.metricGoal > 0n ? `/${r.metricGoal.toLocaleString("pt-BR")}` : ""} {r.metric}
                                    </span>
                                  )}
                                  {r.location && (
                                    <span
                                      className="t-small"
                                      style={{ maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                      title={r.location}
                                    >
                                      {r.location}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            {exp.certificateTokenId > 0n ? (
                              <div className="stack gap-4">
                                <Link
                                  href={`/certificate/${exp.certificateTokenId}`}
                                  className="link link-accent row gap-4"
                                  style={{ fontSize: "12px" }}
                                >
                                  <Award size={13} />
                                  #{exp.certificateTokenId.toString()}
                                </Link>
                                <Link
                                  href={`/certificate/${exp.certificateTokenId}`}
                                  className="btn btn-ghost btn-sm row gap-4"
                                  style={{ fontSize: "11px", textDecoration: "none", whiteSpace: "nowrap" }}
                                >
                                  <Award size={11} />
                                  Ver certificado
                                </Link>
                              </div>
                            ) : (
                              <span style={{ color: "var(--border)", fontSize: "12px" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div
                  className="row gap-8"
                  style={{ justifyContent: "center", padding: "16px", borderTop: "1px solid var(--border)" }}
                >
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="btn btn-ghost btn-sm"
                  >
                    Anterior
                  </button>
                  <span className="t-small">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="btn btn-ghost btn-sm"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm receipt modal */}
      {confirmExp !== null && (
        <ConfirmModal
          onConfirm={() => handleConfirm(confirmExp)}
          onCancel={() => setConfirmExp(null)}
          loading={confirmingId === confirmExp}
        />
      )}

      {/* Reject receipt modal */}
      {rejectExp !== null && (
        <RejectModal
          onConfirm={() => handleReject(rejectExp)}
          onCancel={() => setRejectExp(null)}
          loading={rejectingId === rejectExp}
        />
      )}

      {/* Close pool modal */}
      {showCloseModal && pool && (
        <div className="backdrop" onClick={() => setShowCloseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="t-h3" style={{ marginBottom: "12px" }}>Encerrar Fundo</h3>
            <p className="t-body" style={{ marginBottom: "8px", color: "var(--muted)" }}>
              Você está prestes a encerrar permanentemente o fundo:
            </p>
            <p style={{ fontWeight: 700, marginBottom: "20px", color: "var(--bright)" }}>
              {pool.name}
            </p>
            <p className="t-small" style={{ marginBottom: "24px", color: "var(--amber)" }}>
              Ação irreversível nenhum novo gasto poderá ser registrado neste fundo após o encerramento.
            </p>
            {expenditures.filter(e => !e.confirmedByBeneficiary).length > 0 && (
              <p className="t-small" style={{ marginBottom: "16px", color: "var(--amber)", fontWeight: 600 }}>
                Atenção: {expenditures.filter(e => !e.confirmedByBeneficiary).length} gasto(s) ainda aguardam confirmação de recebimento.
              </p>
            )}
            <div className="row gap-10">
              <button onClick={() => setShowCloseModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={handleClosePool}
                disabled={closingPool}
                className="btn btn-danger-outline"
                style={{ flex: 1 }}
              >
                {closingPool ? "Aguardando..." : "Confirmar encerramento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
