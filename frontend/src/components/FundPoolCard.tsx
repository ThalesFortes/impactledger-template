"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FundPool, formatEth, formatDate, CATEGORY_ODS } from "@/lib/contract";

function Progress({ percent }: { percent: number }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWidth(percent);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [percent]);

  return (
    <div ref={ref} className="track track-sm">
      <div className="fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    "Meio Ambiente": "var(--ok)",
    "Educação":      "var(--accent)",
    "Saúde":         "var(--amber)",
    "ESG":           "var(--mid)",
    "Social":        "var(--bright)",
    "Cultura":       "var(--muted)",
  };
  return map[cat] ?? "var(--muted)";
}

interface Props {
  pool: FundPool;
  dim?: boolean;
}

export default function FundPoolCard({ pool, dim = false }: Props) {
  const percent =
    pool.totalAmount > 0n
      ? Number((pool.spentAmount * 100n) / pool.totalAmount)
      : 0;

  const ods = CATEGORY_ODS[pool.category];

  return (
    <Link href={`/pool/${pool.id}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        className="card card-hover"
        style={{ opacity: dim ? 0.82 : 1, height: "100%" }}
      >
        {/* Top row: category pill + status */}
        <div className="row gap-6" style={{ marginBottom: "12px", flexWrap: "wrap" }}>
          <span
            className="pill"
            style={{
              background: `color-mix(in srgb, ${categoryColor(pool.category)} 12%, transparent)`,
              color: categoryColor(pool.category),
              border: `1px solid color-mix(in srgb, ${categoryColor(pool.category)} 28%, transparent)`,
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

        {/* Fund name */}
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--bright)",
            lineHeight: 1.3,
            margin: "0 0 16px",
          }}
        >
          {pool.name}
        </h3>

        {/* Progress bar */}
        <Progress percent={percent} />

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            margin: "10px 0 14px",
          }}
        >
          <div>
            <div className="kpi-label">Gasto</div>
            <div className="mono" style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}>
              {formatEth(pool.spentAmount)}
            </div>
          </div>
          <div>
            <div className="kpi-label">Alocado</div>
            <div className="mono" style={{ fontSize: "13px", color: "var(--ghost)", fontWeight: 600 }}>
              {formatEth(pool.totalAmount)}
            </div>
          </div>
          <div>
            <div className="kpi-label">Utilização</div>
            <div
              className="mono"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: percent >= 80 ? "var(--amber)" : "var(--ok)",
              }}
            >
              {percent}%
            </div>
          </div>
        </div>

        <div className="divider" style={{ marginBottom: "12px" }} />

        {/* Bottom: ODS badges + date */}
        <div className="row gap-8" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
          <div className="row gap-4" style={{ flexWrap: "wrap" }}>
            {ods &&
              ods.ids.map((id) => (
                <span key={id} className="tag">
                  ODS {id}
                </span>
              ))}
          </div>
          <span className="t-small" style={{ color: "var(--muted)", fontSize: "11px" }}>
            {formatDate(pool.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
