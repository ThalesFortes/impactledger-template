"use client";
import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function Svg({ size, className, style, children }: { size: number; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
}

export function ShieldCheck({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></Svg>;
}

export function Wallet({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M17 13h.01" /></Svg>;
}

export function ArrowUpRight({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M7 17L17 7" /><path d="M8 7h9v9" /></Svg>;
}

export function Layers({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></Svg>;
}

export function Activity({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
}

export function Users({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
}

export function Lock({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
}

export function Link2({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Svg>;
}

export function ExternalLink({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></Svg>;
}

export function Copy({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>;
}

export function ArrowLeft({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></Svg>;
}

export function ArrowRight({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></Svg>;
}

export function Leaf({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></Svg>;
}

export function Plus({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
}

export function FileText({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Svg>;
}

export function Receipt({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><path d="M8 7h8" /><path d="M8 11h8" /></Svg>;
}

export function Award({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></Svg>;
}

export function Pin({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></Svg>;
}

export function Vote({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M9 12l2 2 4-4" /><path d="M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></Svg>;
}

export function Settings({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Svg>;
}

export function Building({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M3 21h18" /><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M9 7h.01" /><path d="M15 7h.01" /><path d="M9 11h.01" /><path d="M15 11h.01" /><path d="M10 21v-4h4v4" /></Svg>;
}

export function Eye({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></Svg>;
}

export function Handshake({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M11 17l2 2a1 1 0 0 0 1.42 0l3-3" /><path d="M3 7l4-1 5 5" /><path d="M13 7l3-1 5 4-3 3-2-1" /><path d="M3 11l3 3" /></Svg>;
}

export function Globe({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Svg>;
}

export function Alert({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>;
}

export function Upload({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></Svg>;
}

export function Coins({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M9 9a6 6 0 1 0 0 12A6 6 0 0 0 9 9z" /><path d="M15 3a6 6 0 0 0-5.74 4.28" /><path d="M18.09 9.91A6 6 0 0 1 15 15" /></Svg>;
}

export function TrendUp({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></Svg>;
}

export function Check({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M20 6L9 17l-5-5" /></Svg>;
}

export function Menu({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></Svg>;
}

export function X({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M18 6L6 18" /><path d="M6 6l12 12" /></Svg>;
}

export function ChevRight({ size = 18, className = "", style }: IconProps) {
  return <Svg size={size} className={className} style={style}><path d="M9 18l6-6-6-6" /></Svg>;
}
