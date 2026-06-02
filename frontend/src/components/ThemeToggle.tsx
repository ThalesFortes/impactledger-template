"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("il-theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("il-theme", theme);
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="btn btn-soft btn-sm"
      style={{ padding: "7px 10px", fontSize: "15px", lineHeight: 1, minWidth: 36 }}
      aria-label="Alternar tema"
    >
      {dark ? "☀" : "◑"}
    </button>
  );
}
