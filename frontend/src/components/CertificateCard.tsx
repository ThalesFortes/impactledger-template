"use client";
import { useState, useEffect } from "react";
import {
  getTokenURI,
  parseTokenURI,
  NFTMeta,
  formatDate,
  sepoliaEtherscan,
  ipfsGatewayUrl,
  CONTRACT_ADDRESS,
} from "@/lib/contract";
import { ExternalLink, Copy, Check } from "@/components/Icons";

interface Props {
  tokenId: bigint;
}

function CertificateArt() {
  return (
    <svg
      viewBox="0 0 480 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", display: "block" }}
    >
      <defs>
        <linearGradient id="certGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1380C4" />
          <stop offset="100%" stopColor="#18A06A" />
        </linearGradient>
        <radialGradient id="dotGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(19,128,196,0.22)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="480" height="200" fill="url(#certGrad)" />
      {/* dot grid */}
      {[...Array(12)].map((_, r) =>
        [...Array(24)].map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={c * 20 + 10}
            cy={r * 20 + 10}
            r={1}
            fill="rgba(255,255,255,0.18)"
          />
        ))
      )}
      {/* shield icon */}
      <g transform="translate(200,52)" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 72s26-13 26-32V16L40 6 14 16v24c0 19 26 32 26 32z" />
        <path d="M29 38l7 7 13-13" />
      </g>
      {/* label */}
      <text x="240" y="145" textAnchor="middle" fill="rgba(255,255,255,0.92)" fontSize="13" fontFamily="system-ui,sans-serif" letterSpacing="3" fontWeight="600">CERTIFICADO DE IMPACTO</text>
      <text x="240" y="168" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontFamily="monospace" letterSpacing="1">GreenTrace · Blockchain Sepolia</text>
    </svg>
  );
}

export default function CertificateCard({ tokenId }: Props) {
  const [meta, setMeta] = useState<NFTMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTokenURI(tokenId)
      .then((uri) => {
        const parsed = parseTokenURI(uri);
        if (parsed) setMeta(parsed);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tokenId]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="gradborder">
        <div className="gradborder-inner" style={{ padding: "28px" }}>
          <div className="skel" style={{ height: "200px", marginBottom: "20px" }} />
          <div className="skel" style={{ height: "16px", width: "70%", marginBottom: "10px" }} />
          <div className="skel" style={{ height: "12px", width: "50%" }} />
        </div>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
        Certificado não encontrado ou contrato não implantado.
      </div>
    );
  }

  const attrMap = Object.fromEntries(meta.attributes.map((a) => [a.trait_type, a.value]));
  const confirmedTs = attrMap["Confirmado em"] ? BigInt(attrMap["Confirmado em"]) : null;

  return (
    <div className="gradborder">
      <div className="gradborder-inner">
        {/* SVG art — clicável abre no Etherscan */}
        <a
          href={`${sepoliaEtherscan(CONTRACT_ADDRESS)}?a=${tokenId}#tokentxnsErc721`}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver NFT no Etherscan"
          style={{
            display: "block",
            borderRadius: "var(--r-20) var(--r-20) 0 0",
            overflow: "hidden",
            position: "relative",
            cursor: "pointer",
          }}
          className="cert-img-wrap"
        >
          {meta.image && meta.image.startsWith("data:image/svg") ? (
            <img
              src={meta.image}
              alt={meta.name}
              style={{
                width: "100%",
                display: "block",
                minHeight: "280px",
                objectFit: "cover",
                transition: "transform 300ms ease, filter 300ms ease",
              }}
              className="cert-img"
            />
          ) : (
            <CertificateArt />
          )}
          {/* Overlay de hover */}
          <div className="cert-img-overlay" style={{
            position: "absolute",
            inset: 0,
            background: "rgba(19,128,196,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 200ms ease",
          }}>
            <span style={{
              background: "rgba(255,255,255,0.92)",
              borderRadius: "999px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}>
              <ExternalLink size={14} />
              Ver no Etherscan
            </span>
          </div>
        </a>

        {/* CTA abaixo do SVG */}
        <a
          href={`${sepoliaEtherscan(CONTRACT_ADDRESS)}?a=${tokenId}#tokentxnsErc721`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px 20px",
            background: "var(--raised)",
            borderTop: "1px solid var(--border)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
            transition: "background 150ms ease, color 150ms ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--raised)";
          }}
        >
          <ExternalLink size={14} />
          Clique aqui para ver <strong style={{ color: "var(--bright)" }}>{meta.name}</strong> no Etherscan
        </a>

        <div style={{ padding: "24px" }}>
          {/* Title row */}
          <div className="row gap-10" style={{ justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--bright)", margin: 0 }}>
              {meta.name}
            </h3>
            <span className="badge badge-ok">
              <Check size={12} />
              ERC-721 On-chain
            </span>
          </div>

          <div className="divider" style={{ marginBottom: "16px" }} />

          {/* Meta grid */}
          <div
            className="meta-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}
          >
            {attrMap["Fundo"] && (
              <div>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Fundo</div>
                <div style={{ fontSize: "13px", color: "var(--ghost)" }}>{attrMap["Fundo"]}</div>
              </div>
            )}
            {attrMap["Categoria"] && (
              <div>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Categoria</div>
                <div style={{ fontSize: "13px", color: "var(--ghost)" }}>{attrMap["Categoria"]}</div>
              </div>
            )}
            {attrMap["Valor ETH"] && (
              <div>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Valor</div>
                <div className="mono" style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)" }}>
                  {attrMap["Valor ETH"]} ETH
                </div>
              </div>
            )}
            {attrMap["Valor Fiat"] && (
              <div>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Valor fiat</div>
                <div style={{ fontSize: "13px", color: "var(--ghost)" }}>{attrMap["Valor Fiat"]}</div>
              </div>
            )}
            {attrMap["Beneficiario"] && (
              <div className="meta-full" style={{ gridColumn: "1 / -1" }}>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Beneficiário</div>
                <a
                  href={sepoliaEtherscan(attrMap["Beneficiario"])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link mono"
                  style={{ fontSize: "12px", wordBreak: "break-all" }}
                >
                  {attrMap["Beneficiario"]}
                </a>
              </div>
            )}
            {attrMap["Descricao"] && (
              <div className="meta-full" style={{ gridColumn: "1 / -1" }}>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Descrição</div>
                <div style={{ fontSize: "13px", color: "var(--ghost)" }}>{attrMap["Descricao"]}</div>
              </div>
            )}
            {confirmedTs && confirmedTs > 0n && (
              <div className="meta-full" style={{ gridColumn: "1 / -1" }}>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Confirmado em</div>
                <div style={{ fontSize: "13px", color: "var(--muted)" }}>{formatDate(confirmedTs)}</div>
              </div>
            )}
            {attrMap["Comprovante IPFS"] && (
              <div className="meta-full" style={{ gridColumn: "1 / -1" }}>
                <div className="kpi-label" style={{ marginBottom: "4px" }}>Comprovante IPFS</div>
                <a
                  href={ipfsGatewayUrl(attrMap["Comprovante IPFS"])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                  style={{ fontSize: "12px", wordBreak: "break-all" }}
                >
                  {attrMap["Comprovante IPFS"]}
                </a>
              </div>
            )}
          </div>

          {/* Impact tags if description has metric info */}
          {(attrMap["Beneficiados"] || attrMap["Indicador"]) && (
            <>
              <div className="divider" style={{ marginBottom: "14px" }} />
              <div className="row gap-8" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
                {attrMap["Beneficiados"] && (
                  <span className="tag">{attrMap["Beneficiados"]} beneficiados</span>
                )}
                {attrMap["Indicador"] && (
                  <span className="tag">{attrMap["Indicador"]}</span>
                )}
                {attrMap["Localização"] && (
                  <span className="tag">{attrMap["Localização"]}</span>
                )}
              </div>
            </>
          )}

          <div className="divider" style={{ marginBottom: "16px" }} />

          {/* Actions */}
          <div className="row gap-10">
            <a
              href={`${sepoliaEtherscan(CONTRACT_ADDRESS)}?a=${tokenId}#tokentxnsErc721`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              <ExternalLink size={15} />
              Ver no Etherscan
            </a>
            <button onClick={handleCopy} className="btn btn-primary" style={{ flex: 1 }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copiado!" : "Copiar URL"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
