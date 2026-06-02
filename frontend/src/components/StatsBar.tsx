"use client";
import { ContractStats, formatEth } from "@/lib/contract";
import { Wallet, ArrowUpRight, Layers, Activity, Users } from "@/components/Icons";

interface Props {
  stats: ContractStats | null;
  loading: boolean;
}

const ITEMS = [
  {
    key: "totalAllocated",
    label: "Total Alocado",
    icon: Wallet,
    fmt: (s: ContractStats) => `${formatEth(s.totalAllocated)} ETH`,
  },
  {
    key: "totalSpent",
    label: "Total Gasto",
    icon: ArrowUpRight,
    fmt: (s: ContractStats) => `${formatEth(s.totalSpent)} ETH`,
  },
  {
    key: "poolCount",
    label: "Fundos Ativos",
    icon: Layers,
    fmt: (s: ContractStats) => s.poolCount.toString(),
  },
  {
    key: "expenditureCount",
    label: "Transações",
    icon: Activity,
    fmt: (s: ContractStats) => s.expenditureCount.toString(),
  },
  {
    key: "totalBeneficiaries",
    label: "Beneficiários",
    icon: Users,
    fmt: (s: ContractStats) => s.totalBeneficiaries.toLocaleString("pt-BR"),
  },
];

export default function StatsBar({ stats, loading }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "16px",
      }}
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="card" style={{ padding: "20px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "12px",
              }}
            >
              <span className="kpi-label">{item.label}</span>
              <span className="icon-circle">
                <Icon size={18} />
              </span>
            </div>
            <div
              className="kpi"
              style={{
                fontSize: "24px",
                opacity: loading ? 0.35 : 1,
                transition: "opacity 200ms",
              }}
            >
              {loading ? "···" : stats ? item.fmt(stats) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
