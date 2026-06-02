"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ShieldCheck, Menu, X, Alert } from "@/components/Icons";
import { useWallet } from "@/lib/hooks";

type ActivePage = "home" | "ativos" | "encerrados" | "admin" | "pool" | "certificate";

interface Props {
  active?: ActivePage;
  backHref?: string;
  backLabel?: string;
}

const NAV_LINKS = [
  { label: "Início",         href: "/",                  active: "home"       },
  { label: "Fundos Ativos",  href: "/fundos/ativos",     active: "ativos"     },
  { label: "Encerrados",     href: "/fundos/encerrados", active: "encerrados" },
  { label: "Admin",          href: "/admin",             active: "admin"      },
] as const;

function WalletBtn() {
  const { address, loading, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="row gap-8">
        <span
          className="pill mono"
          style={{
            background: "var(--raised)", color: "var(--mid)",
            border: "1px solid var(--border)", fontSize: "12px",
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button onClick={disconnect} className="btn btn-ghost btn-sm">
          Desconectar
        </button>
      </div>
    );
  }
  return (
    <button onClick={connect} disabled={loading} className="btn btn-primary btn-sm">
      {loading ? "Conectando..." : "Conectar Carteira"}
    </button>
  );
}

function NetworkBanner() {
  const { wrongNetwork, switchToSepolia } = useWallet();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  function dismiss() {
    setExiting(true);
    setTimeout(() => { setVisible(false); setExiting(false); }, 350);
  }

 
  useEffect(() => {
    if (wrongNetwork) {
      setVisible(true);
      setExiting(false);
      const t = setTimeout(dismiss, 6000);
      return () => clearTimeout(t);
    } else {
      if (visible) dismiss();
    }
  }, [wrongNetwork]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      top: "68px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 50,
      width: "min(680px, calc(100vw - 32px))",
      animation: exiting
        ? "bannerOut 350ms ease-in forwards"
        : "bannerIn 350ms ease-out forwards",
    }}>
      <div className="row gap-12" style={{
        justifyContent: "space-between", flexWrap: "wrap",
        padding: "12px 18px", borderRadius: "10px",
        background: "var(--amber)",
        boxShadow: "0 4px 20px rgba(201,114,28,0.35)",
        color: "#fff", fontSize: "14px", fontWeight: 500,
      }}>
        <span className="row gap-8">
          <Alert size={16} />
          Rede incorreta, conecte na <strong>Sepolia</strong> para enviar transações.
        </span>
        <button
          className="btn btn-sm"
          style={{ background: "rgba(0,0,0,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", flexShrink: 0 }}
          onClick={() => { switchToSepolia(); dismiss(); }}
        >
          Trocar para Sepolia
        </button>
      </div>
    </div>
  );
}

export default function AppHeader({ active, backHref, backLabel }: Props) {
  const [mob, setMob] = useState(false);

  return (
    <>
    <header className="appbar">
      <div className="appbar-inner">
        {/* Brand */}
        <div className="row gap-16">
          {backHref && (
            <Link href={backHref} className="link hide-mobile" style={{ fontSize: "13px" }}>
              ← {backLabel ?? "Voltar"}
            </Link>
          )}
          <Link href="/" className="brand">
            <div className="brand-mark">
              <ShieldCheck size={19} style={{ color: "#fff" } as React.CSSProperties} />
            </div>
            <span className="brand-name">Green<b>Trace</b></span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="nav hide-mobile">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${active === l.active ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="row gap-8">
          <ThemeToggle />
          <div className="hide-mobile"><WalletBtn /></div>
          <button
            className="btn btn-soft btn-sm only-mobile"
            onClick={() => setMob((v) => !v)}
            aria-label="Menu"
            style={{ padding: "7px 9px" }}
          >
            {mob ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mob && (
        <div
          className="only-mobile enter"
          style={{
            background: "var(--surface)", borderTop: "1px solid var(--border)",
            padding: "12px 16px", display: "flex", flexDirection: "column", gap: "4px",
          }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${active === l.active ? " active" : ""}`}
              style={{ padding: "10px 8px" }}
              onClick={() => setMob(false)}
            >
              {l.label}
            </Link>
          ))}
          <div style={{ padding: "8px 0" }}><WalletBtn /></div>
        </div>
      )}
    </header>
    <NetworkBanner />
    </>
  );
}

