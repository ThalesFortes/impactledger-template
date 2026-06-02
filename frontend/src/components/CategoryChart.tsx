"use client";
import { useEffect, useState } from "react";
import { FundPool } from "@/lib/contract";
import { ethers } from "ethers";

const CHART_COLORS = [
  "#2F9FA8",
  "#45C7A6",
  "#5FE3A4",
  "#1C5E7B",
  "#103049",
  "#93EFC4",
  "#0B2236",
  "#CFF7E4",
];

interface Props {
  pools: FundPool[];
}

export default function CategoryChart({ pools }: Props) {
  const [animated, setAnimated] = useState(false);

  const byCategory = pools.reduce<Record<string, bigint>>((acc, pool) => {
    if (pool.spentAmount > 0n) {
      acc[pool.category] = (acc[pool.category] || 0n) + pool.spentAmount;
    }
    return acc;
  }, {});

  const data = Object.entries(byCategory).map(([name, value]) => ({
    name,
    value: parseFloat(ethers.formatEther(value)),
  }));

  useEffect(() => {
    if (data.length === 0) return;
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "180px",
          color: "var(--muted)",
          fontSize: "13px",
        }}
      >
        Nenhum gasto registrado ainda
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 90;
  const cy = 90;
  const r = 70;
  const ir = 44;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = data.map((d, i) => {
    const pct = d.value / total;
    const dash = animated ? pct * circumference : 0;
    const gap = circumference - dash;
    const arc = {
      ...d,
      pct,
      dash,
      gap,
      offset,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
    offset += pct * circumference;
    return arc;
  });

  return (
    <div className="row gap-16" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg
          width={180}
          height={180}
          viewBox="0 0 180 180"
          style={{ display: "block" }}
        >
          {/* track circle */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--raised)"
            strokeWidth={26}
          />
          {/* arcs */}
          {arcs.map((arc) => (
            <circle
              key={arc.name}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={26}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={-arc.offset}
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke-dasharray 900ms cubic-bezier(.22,.61,.36,1)" }}
            />
          ))}
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            className="mono"
            style={{ fontSize: "14px", fontWeight: 700, color: "var(--bright)", lineHeight: 1 }}
          >
            {total.toFixed(3)}
          </span>
          <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
            ETH gasto
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="stack gap-8" style={{ flex: 1, minWidth: "120px" }}>
        {arcs.map((arc) => (
          <div key={arc.name} className="row gap-8">
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                background: arc.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: "var(--ghost)", fontWeight: 500 }}>
                {arc.name}
              </div>
              <div className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                {arc.value.toFixed(3)} ETH · {(arc.pct * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
