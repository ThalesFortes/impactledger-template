"use client";
import { useEffect, useRef, useState } from "react";
import { Expenditure } from "@/lib/contract";
import { ethers } from "ethers";

interface Props {
  expenditures: Expenditure[];
}

export default function SpendingTimeline({ expenditures }: Props) {
  const [animated, setAnimated] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (expenditures.length === 0) return null;

  const sorted = [...expenditures].sort(
    (a, b) => Number(a.timestamp) - Number(b.timestamp)
  );

  const byDay = new Map<string, { label: string; amount: number }>();
  for (const exp of sorted) {
    const ts = Number(exp.timestamp);
    const date = new Date(ts * 1000);
    const key = date.toISOString().split("T")[0];
    const label = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    if (!byDay.has(key)) byDay.set(key, { label, amount: 0 });
    byDay.get(key)!.amount += parseFloat(ethers.formatEther(exp.amount));
  }

  const data = Array.from(byDay.values()).map((v) => ({
    label: v.label,
    amount: parseFloat(v.amount.toFixed(4)),
  }));

  const maxVal = Math.max(...data.map((d) => d.amount));

  return (
    <div ref={ref} style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          minWidth: `${data.length * 44}px`,
          height: "120px",
          paddingBottom: "24px",
          position: "relative",
        }}
      >
        {data.map((d, i) => {
          const heightPct = maxVal > 0 ? (d.amount / maxVal) * 100 : 0;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="tip"
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* tooltip */}
              <div className="tip-bubble" style={{ opacity: isHovered ? 1 : 0, transform: `translateX(-50%) translateY(${isHovered ? 0 : 4}px)` }}>
                {d.amount.toFixed(4)} ETH
              </div>
              {/* bar */}
              <div
                style={{
                  width: "100%",
                  maxWidth: "36px",
                  height: animated ? `${heightPct}%` : "0%",
                  minHeight: animated && d.amount > 0 ? "4px" : "0px",
                  borderRadius: "4px 4px 0 0",
                  background: isHovered ? "var(--accent)" : "var(--muted)",
                  transition: "height 700ms cubic-bezier(.22,.61,.36,1), background 150ms ease",
                  cursor: "pointer",
                }}
              />
            </div>
          );
        })}

        {/* x-axis labels */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            gap: "8px",
          }}
        >
          {data.map((d, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: "10px",
                color: "var(--muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
