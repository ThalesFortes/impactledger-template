"use client";
import Link from "next/link";
import {
  Expenditure,
  FundPool,
  formatEth,
  formatDate,
  shortAddress,
  sepoliaEtherscan,
} from "@/lib/contract";
import { Award } from "@/components/Icons";

interface Props {
  expenditures: Expenditure[];
  loading: boolean;
  pools?: FundPool[];
}

export default function RecentTransactions({
  expenditures,
  loading,
  pools = [],
}: Props) {
  const poolMap = Object.fromEntries(pools.map((p) => [p.id.toString(), p]));

  if (loading) {
    return (
      <div className="stack gap-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skel" style={{ height: "58px" }} />
        ))}
      </div>
    );
  }

  if (expenditures.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          color: "var(--muted)",
          fontSize: "13px",
        }}
      >
        Nenhuma transação registrada ainda.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {expenditures.map((exp, i) => {
        const pool = poolMap[exp.poolId.toString()];
        return (
          <div
            key={exp.id.toString()}
            className="row"
            style={{
              padding: "14px 20px",
              borderTop: i === 0 ? "none" : "1px solid var(--border)",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Left: description + pool tag + address */}
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div className="row gap-8" style={{ marginBottom: "3px", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--bright)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {exp.description}
                </span>
                <Link href={`/pool/${exp.poolId}`} className="tag" style={{ flexShrink: 0 }}>
                  {pool ? pool.name : `Fundo #${exp.poolId}`}
                </Link>
              </div>
              <div className="row gap-6 t-small">
                <a
                  href={sepoliaEtherscan(exp.beneficiary)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mono"
                  style={{ fontSize: "12px" }}
                >
                  {shortAddress(exp.beneficiary)}
                </a>
                <span style={{ color: "var(--border)" }}>·</span>
                <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                  {formatDate(exp.timestamp)}
                </span>
              </div>
            </div>

            {/* ETH amount */}
            <div
              className="mono"
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--accent)",
                flexShrink: 0,
              }}
            >
              {formatEth(exp.amount)} ETH
            </div>

            {/* Status badge */}
            <div style={{ flexShrink: 0 }}>
              {exp.confirmedByBeneficiary ? (
                <span className="badge badge-ok">
                  <Check />
                  Validado
                </span>
              ) : (
                <span className="badge badge-pend pulse-ring">Aguardando</span>
              )}
            </div>

            {/* NFT link */}
            <div style={{ flexShrink: 0, minWidth: "60px" }}>
              {exp.certificateTokenId > 0n ? (
                <Link
                  href={`/certificate/${exp.certificateTokenId}`}
                  className="row gap-4 link-accent"
                  style={{ fontSize: "12px" }}
                >
                  <Award size={14} />
                  NFT #{exp.certificateTokenId.toString()}
                </Link>
              ) : (
                <span style={{ color: "var(--border)", fontSize: "12px" }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Check() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
