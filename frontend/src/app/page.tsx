"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StatsBar from "@/components/StatsBar";
import FundPoolCard from "@/components/FundPoolCard";
import RecentTransactions from "@/components/RecentTransactions";
import CategoryChart from "@/components/CategoryChart";
import SpendingTimeline from "@/components/SpendingTimeline";
import { usePools, useStats, useRecentExpenditures } from "@/lib/hooks";
import { ShieldCheck, Layers, Users, Building, Eye, ExternalLink, Link2, Activity } from "@/components/Icons";
import AppHeader from "@/components/AppHeader";

// ── CountUp ──────────────────────────────────────────────────────────────────
function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const duration = 1200;
        const animate = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setValue(parseFloat((ease * to).toFixed(decimals)));
          if (t < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, decimals]);

  return <span ref={ref}>{value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

// ── SectionHead ──────────────────────────────────────────────────────────────
function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="row gap-16"
      style={{ justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap" }}
    >
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: "6px" }}>{eyebrow}</div>}
        <h2 className="t-h2">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { pools, loading: poolsLoading } = usePools();
  const { stats, loading: statsLoading } = useStats();
  const { expenditures, loading: expLoading } = useRecentExpenditures(10);

  const activePools = pools.filter((p) => p.active);
  const closedCount = pools.length - activePools.length;
  const displayStats = stats ? { ...stats, poolCount: BigInt(activePools.length) } : null;

  const totalEth =
    stats && stats.totalAllocated > 0n
      ? parseFloat(
          (Number(stats.totalAllocated) / 1e18).toFixed(2)
        )
      : 0;

  return (
    <main style={{ minHeight: "100vh", background: "var(--base)" }}>
      <AppHeader active="home" />

      {/* ── Hero ── */}
      <section
        style={{
          background: "var(--grad-hero)",
          borderBottom: "1px solid var(--border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* dotgrid overlay */}
        <div
          className="dotgrid"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
        <div className="wrap" style={{ paddingTop: "72px", paddingBottom: "72px", position: "relative" }}>
          <div className="enter" style={{ maxWidth: "640px" }}>
            <span
              className="pill"
              style={{
                background: "rgba(19,128,196,0.10)",
                color: "var(--accent)",
                border: "1px solid rgba(19,128,196,0.25)",
                marginBottom: "20px",
                display: "inline-flex",
              }}
            >
              <ShieldCheck size={14} />
              Prova criptográfica de impacto
            </span>

            <h1 className="t-h1" style={{ marginBottom: "20px" }}>
              Cada gasto verificado.<br />
              Cada beneficiário confirmado.
            </h1>

            <p className="t-body" style={{ maxWidth: "520px", marginBottom: "28px" }}>
              O GreenTrace substitui confiança cega por prova criptográfica blockchain Sepolia +
              IPFS. Transparência auditável para fundos de impacto social.
            </p>

            <div className="row gap-12" style={{ flexWrap: "wrap", marginBottom: "36px" }}>
              <Link href="/fundos/ativos" className="btn btn-primary">
                <Layers size={16} />
                Ver Fundos Ativos
              </Link>
              <a
                href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                <ExternalLink size={15} />
                Auditar contrato
              </a>
            </div>

            {/* Floating stats pill */}
            {!statsLoading && stats && (
              <div
                className="row gap-20"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-12)",
                  padding: "14px 20px",
                  boxShadow: "var(--sh-sm)",
                  display: "inline-flex",
                  flexWrap: "wrap",
                  gap: "20px",
                }}
              >
                <div>
                  <div className="kpi-label">ETH alocados</div>
                  <div className="kpi" style={{ fontSize: "20px" }}>
                    <CountUp
                      to={parseFloat((Number(stats.totalAllocated) / 1e18).toFixed(2))}
                      decimals={2}
                    />
                  </div>
                </div>
                <div style={{ width: "1px", background: "var(--border)" }} />
                <div>
                  <div className="kpi-label">Fundos</div>
                  <div className="kpi" style={{ fontSize: "20px" }}>
                    <CountUp to={Number(stats.poolCount)} />
                  </div>
                </div>
                <div style={{ width: "1px", background: "var(--border)" }} />
                <div>
                  <div className="kpi-label">Beneficiários</div>
                  <div className="kpi" style={{ fontSize: "20px" }}>
                    <CountUp to={Number(stats.totalBeneficiaries)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="wrap">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div className="eyebrow" style={{ marginBottom: "8px" }}>Como funciona</div>
            <h2 className="t-h2">Transparência em 3 etapas</h2>
          </div>
          <div
            className="how-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}
          >
            {[
              {
                step: "01",
                icon: <Layers size={22} />,
                title: "Fundo criado on-chain",
                desc: "ONG, empresa ou governo aloca verba e define categoria. Valor e regras ficam permanentemente gravados na blockchain.",
              },
              {
                step: "02",
                icon: <Link2 size={22} />,
                title: "Gastos com comprovantes",
                desc: "Cada pagamento é registrado imutavelmente, com hash IPFS do documento como evidência verificável.",
              },
              {
                step: "03",
                icon: <ShieldCheck size={22} />,
                title: "Beneficiário assina → NFT",
                desc: "Só o beneficiário pode confirmar o recebimento. A confirmação gera um certificado NFT verificável on-chain.",
              },
            ].map((item, i) => (
              <div key={i} style={{ position: "relative" }}>
                <div className="card" style={{ height: "100%", padding: "24px" }}>
                  <div className="row gap-12" style={{ marginBottom: "16px" }}>
                    <div className="icon-circle">{item.icon}</div>
                    <span
                      className="eyebrow"
                      style={{ fontSize: "14px", color: "var(--accent)" }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--bright)", marginBottom: "8px" }}>
                    {item.title}
                  </h3>
                  <p className="t-small" style={{ lineHeight: 1.7 }}>{item.desc}</p>
                </div>
                {/* step dash connector */}
                {i < 2 && <div className="step-dash" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow="On-chain em tempo real" title="Visão Geral" />
          <StatsBar stats={displayStats} loading={statsLoading} />
        </div>
      </section>

      {/* ── Stakeholders ── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="wrap">
          <SectionHead eyebrow="Para quem é" title="Stakeholders" />
          <div
            className="stk-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}
          >
            {[
              {
                icon: <Users size={20} />,
                title: "ONGs e fundações",
                desc: "Prove a doadores que cada real chegou ao destino — com assinatura digital do beneficiário.",
              },
              {
                icon: <Building size={20} />,
                title: "Empresas ESG",
                desc: "Documente investimento social verificável para relatórios ESG e auditorias externas.",
              },
              {
                icon: <Activity size={20} />,
                title: "Governos",
                desc: "Publique gastos de programas sociais com rastreabilidade total do autorizado ao recebido.",
              },
              {
                icon: <Eye size={20} />,
                title: "Doadores e cidadãos",
                desc: "Acompanhe em tempo real o destino de cada contribuição, sem depender de relatórios anuais.",
              },
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: "22px" }}>
                <div className="icon-circle" style={{ marginBottom: "14px" }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--bright)", marginBottom: "8px" }}>
                  {item.title}
                </h3>
                <p className="t-small" style={{ lineHeight: 1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funds + Donut ── */}
      <section className="section">
        <div className="wrap">
          <div
            className="home-funds"
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "28px" }}
          >
            {/* Active funds */}
            <div>
              <SectionHead
                eyebrow="Em andamento"
                title="Fundos Ativos"
                action={
                  <div className="row gap-10">
                    <Link href="/fundos/ativos" className="btn btn-primary btn-sm">
                      <Layers size={14} />
                      Ver todos
                    </Link>
                    {!poolsLoading && closedCount > 0 && (
                      <Link href="/fundos/encerrados" className="btn btn-ghost btn-sm">
                        <ExternalLink size={13} />
                        {closedCount} encerrado{closedCount > 1 ? "s" : ""}
                      </Link>
                    )}
                  </div>
                }
              />
              {poolsLoading ? (
                <div
                  className="funds-grid stagger"
                  style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}
                >
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skel" style={{ height: "180px" }} />
                  ))}
                </div>
              ) : activePools.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "56px",
                    border: "1.5px dashed var(--border)",
                    borderRadius: "var(--r-16)",
                    color: "var(--muted)",
                    fontSize: "14px",
                  }}
                >
                  {pools.length === 0
                    ? "Nenhum fundo criado ainda."
                    : "Todos os fundos foram encerrados."}
                </div>
              ) : (
                <div
                  className="funds-grid stagger"
                  style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}
                >
                  {activePools.slice(0, 6).map((pool) => (
                    <FundPoolCard key={pool.id.toString()} pool={pool} />
                  ))}
                </div>
              )}
            </div>

            {/* Category donut */}
            <div>
              <SectionHead eyebrow="Distribuição" title="Por Categoria" />
              <div className="card" style={{ padding: "24px" }}>
                <CategoryChart pools={pools} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      {!expLoading && expenditures.length > 0 && (
        <section className="section" style={{ background: "var(--surface)" }}>
          <div className="wrap">
            <SectionHead eyebrow="Histórico" title="Ritmo de Gastos" />
            <div className="card" style={{ padding: "24px" }}>
              <SpendingTimeline expenditures={expenditures} />
            </div>
          </div>
        </section>
      )}

      {/* ── Recent Transactions ── */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            eyebrow="Blockchain"
            title="Últimas Transações"
            action={
              <Link href="/fundos/ativos" className="link link-accent" style={{ fontSize: "14px" }}>
                Ver fundos
              </Link>
            }
          />
          <RecentTransactions expenditures={expenditures} loading={expLoading} pools={pools} />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="wrap">
          <div className="gradborder">
            <div className="gradborder-inner" style={{ padding: "48px 40px", textAlign: "center" }}>
              <h2 className="t-h2" style={{ marginBottom: "12px" }}>
                Sua organização gerencia verbas de impacto?
              </h2>
              <p
                className="t-body"
                style={{ maxWidth: "480px", margin: "0 auto 28px", color: "var(--muted)" }}
              >
                ONGs, empresas e prefeituras podem usar o GreenTrace para tornar seus programas
                sociais auditáveis por qualquer pessoa, a qualquer hora, sem intermediários.
              </p>
              <div className="row gap-12" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/admin" className="btn btn-primary">
                  Explorar painel de gestão
                </Link>
                <a
                  href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  <ExternalLink size={15} />
                  Auditar contrato on-chain
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div
          className="wrap"
          style={{ padding: "24px", textAlign: "center" }}
        >
          <p className="t-small" style={{ color: "var(--muted)" }}>
            Dados registrados na blockchain Sepolia · Auditáveis e imutáveis ·{" "}
            <a
              href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Ver contrato no Etherscan
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
