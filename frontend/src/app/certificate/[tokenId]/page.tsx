"use client";
import { use } from "react";
import Link from "next/link";
import CertificateCard from "@/components/CertificateCard";
import AppHeader from "@/components/AppHeader";
import { Lock } from "@/components/Icons";

export default function CertificatePage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId: tokenIdStr } = use(params);

  let tokenId: bigint;
  try {
    tokenId = BigInt(tokenIdStr);
  } catch {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "var(--muted)", fontSize: "14px" }}>Token ID inválido.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--base)" }}>
      <AppHeader active="certificate" backHref="/" backLabel="Início" />

      <div
        className="wrap"
        style={{ paddingTop: "40px", paddingBottom: "56px", maxWidth: "900px" }}
      >
        {/* Page header */}
        <div style={{ marginBottom: "28px" }}>
          <div className="eyebrow" style={{ marginBottom: "6px" }}>ERC-721</div>
          <h1 className="t-h2" style={{ marginBottom: "16px" }}>
            Certificado #{tokenIdStr}
          </h1>

          {/* cert-explain grid */}
          <div
            className="cert-explain"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}
          >
            <div
              className="card"
              style={{
                padding: "16px 18px",
                borderColor: "rgba(30,158,104,0.3)",
                background: "rgba(30,158,104,0.04)",
              }}
            >
              <div
                className="row gap-8"
                style={{ marginBottom: "10px" }}
              >
                <Lock size={14} style={{ color: "var(--ok)" } as React.CSSProperties} />
                <span
                  className="eyebrow"
                  style={{ color: "var(--ok)", fontSize: "11px" }}
                >
                  On-chain (blockchain)
                </span>
              </div>
              <ul
                className="t-small"
                style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.9 }}
              >
                <li>· Identidade do beneficiário</li>
                <li>· Valor e data do pagamento</li>
                <li>· Confirmação de recebimento</li>
                <li>· Imagem SVG do certificado</li>
                <li>· Metadados do NFT completos</li>
              </ul>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <div className="row gap-8" style={{ marginBottom: "10px" }}>
                <span className="eyebrow" style={{ fontSize: "11px" }}>Off-chain (IPFS)</span>
              </div>
              <ul
                className="t-small"
                style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.9 }}
              >
                <li>· Arquivo de comprovante</li>
                <li style={{ color: "var(--muted)", opacity: 0.6 }}>· (hash ancorado on-chain)</li>
              </ul>
              <p className="t-small" style={{ marginTop: "8px", lineHeight: 1.6 }}>
                O hash é gravado no contrato qualquer adulteração é detectável.
              </p>
            </div>
          </div>

          <p className="t-small" style={{ lineHeight: 1.7 }}>
            Os metadados incluindo a imagem SVG são gerados 100% on-chain pelo contrato
            GreenTrace e não dependem de nenhum servidor externo.
          </p>
        </div>

        {/* Certificate card */}
        <CertificateCard tokenId={tokenId} />

        <p
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "var(--muted)",
            marginTop: "24px",
          }}
        >
          Registrado na blockchain Sepolia · Imutável e auditável
        </p>
      </div>
    </main>
  );
}
