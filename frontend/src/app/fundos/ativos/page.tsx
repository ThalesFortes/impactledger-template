"use client";
import { useState } from "react";
import Link from "next/link";
import { usePools } from "@/lib/hooks";
import FundPoolCard from "@/components/FundPoolCard";
import { formatEth } from "@/lib/contract";
import AppHeader from "@/components/AppHeader";

const ALL = "Todos";

export default function FundosAtivosPage() {
  const { pools, loading } = usePools();
  const [category, setCategory] = useState(ALL);

  const active = pools.filter((p) => p.active);
  const categories = [ALL, ...Array.from(new Set(active.map((p) => p.category))).sort()];
  const filtered = category === ALL ? active : active.filter((p) => p.category === category);

  const totalAllocated = active.reduce((s, p) => s + p.totalAmount, 0n);
  const totalSpent = active.reduce((s, p) => s + p.spentAmount, 0n);
  const utilPercent =
    totalAllocated > 0n ? Math.round(Number((totalSpent * 100n) / totalAllocated)) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "var(--base)" }}>
      <AppHeader active="ativos" />

      <div className="wrap" style={{ paddingTop: "40px", paddingBottom: "56px" }}>
        {/* Page header */}
        <div style={{ marginBottom: "32px" }}>
          <div className="eyebrow" style={{ marginBottom: "6px" }}>Em andamento</div>
          <div className="row gap-16" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap" }}>
            <h1 className="t-h2">Fundos ativos</h1>
            <Link href="/fundos/encerrados" className="link" style={{ fontSize: "14px" }}>
              Ver encerrados
            </Link>
          </div>
        </div>

        {/* Summary strip */}
        <div
          className="sum-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}
        >
          {[
            { label: "Fundos", value: loading ? "···" : active.length.toString(), color: "var(--accent)" },
            { label: "Total alocado", value: loading ? "···" : `${formatEth(totalAllocated)} ETH`, color: "var(--mid)" },
            { label: "Total gasto", value: loading ? "···" : `${formatEth(totalSpent)} ETH`, color: "var(--bright)" },
            { label: "Utilização", value: loading ? "···" : `${utilPercent}%`, color: utilPercent > 80 ? "var(--amber)" : "var(--ok)" },
          ].map((item) => (
            <div key={item.label} className="card" style={{ padding: "16px 18px" }}>
              <div className="kpi-label" style={{ marginBottom: "6px" }}>{item.label}</div>
              <div className="kpi" style={{ fontSize: "22px", color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Category filter — sticky */}
        {!loading && categories.length > 1 && (
          <div
            style={{
              position: "sticky",
              top: "64px",
              zIndex: 20,
              background: "var(--base)",
              paddingBottom: "12px",
              marginBottom: "8px",
            }}
          >
            <div className="row gap-8" style={{ flexWrap: "wrap" }}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`fpill${category === cat ? " active" : ""}`}
                >
                  {cat}
                  {cat !== ALL && (
                    <span style={{ marginLeft: "4px", opacity: 0.65, fontSize: "11px" }}>
                      {active.filter((p) => p.category === cat).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div
            className="funds-grid stagger"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skel" style={{ height: "200px" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "var(--muted)",
              fontSize: "14px",
              border: "1.5px dashed var(--border)",
              borderRadius: "var(--r-16)",
            }}
          >
            {active.length === 0
              ? "Nenhum fundo ativo no momento."
              : `Nenhum fundo ativo em "${category}".`}
          </div>
        ) : (
          <>
            <p className="t-small" style={{ marginBottom: "14px" }}>
              {filtered.length} fundo{filtered.length !== 1 ? "s" : ""}
              {category !== ALL ? ` em "${category}"` : ""}
            </p>
            <div
              className="funds-grid stagger"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}
            >
              {filtered.map((pool) => (
                <FundPoolCard key={pool.id.toString()} pool={pool} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
