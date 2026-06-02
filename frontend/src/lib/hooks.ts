"use client";
import { useState, useEffect, useCallback } from "react";
import {
  getAllPools,
  getStats,
  getRecentExpenditures,
  getExpendituresByPool,
  getImpactReport,
  getContractOwner,
  getWriteContract,
  getAllProposals,
  hasVotedOn,
  getTokenBalance,
  getTokenTotalSupply,
  FundPool,
  Expenditure,
  ContractStats,
  ImpactReport,
  Proposal,
  GOVERNANCE_ADDRESS,
  TOKEN_ADDRESS,
} from "./contract";
import { ethers } from "ethers";

export function usePools() {
  const [pools, setPools] = useState<FundPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllPools();
      setPools([...data]);
    } catch (e) {
      setError("Erro ao carregar fundos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { pools, loading, error, refetch: fetch };
}

export function useStats() {
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setStats(await getStats());
    } catch {
      setError("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { stats, loading, error, refetch: fetch };
}

export function useRecentExpenditures(limit = 10) {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentExpenditures(limit)
      .then((data) => setExpenditures([...data]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  return { expenditures, loading };
}

export function usePoolExpenditures(poolId: number) {
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!poolId) {
      setExpenditures([]);
      return;
    }
    try {
      setLoading(true);
      const data = await getExpendituresByPool(poolId);
      setExpenditures([...data]);
    } catch {
      setExpenditures([]);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { expenditures, loading, refetch: fetch };
}

export function useImpactReports(expenditureIds: bigint[]) {
  const [reports, setReports] = useState<Record<string, ImpactReport>>({});
  const [loading, setLoading] = useState(false);
  const key = expenditureIds.map((id) => id.toString()).join(",");

  useEffect(() => {
    if (expenditureIds.length === 0) { setReports({}); return; }
    setLoading(true);
    Promise.all(expenditureIds.map((id) => getImpactReport(id)))
      .then((results) => {
        const map: Record<string, ImpactReport> = {};
        results.forEach((report, i) => {
          if (report.reportedAt > 0n) map[expenditureIds[i].toString()] = report;
        });
        setReports(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { reports, loading };
}

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
const WALLET_CONNECTED_KEY = "greentrace_wallet_connected";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkNetwork = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
    setWrongNetwork(chainId !== SEPOLIA_CHAIN_ID);
  }, []);

  const setWalletInfo = useCallback(async (addr: string) => {
    setAddress(addr);
    setOwnerLoading(true);
    try {
      const owner = await getContractOwner();
      setIsOwner(addr.toLowerCase() === owner.toLowerCase());
    } catch {
      setIsOwner(false);
    } finally {
      setOwnerLoading(false);
    }
    await checkNetwork();
  }, [checkNetwork]);

  // Reconecta silenciosamente APENAS se o usuário conectou explicitamente antes
  // e ainda não desconectou. Navegação entre páginas não dispara popup do MetaMask.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    // Verifica rede sempre — independente de estar conectado
    checkNetwork();

    if (localStorage.getItem(WALLET_CONNECTED_KEY) === "true") {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          const list = accounts as string[];
          if (list.length > 0) setWalletInfo(list[0]);
        })
        .catch(() => {});
    }

    const handleChainChanged = () => checkNetwork();
    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length > 0) {
        setWalletInfo(list[0]);
      } else {
        setAddress(null);
        setIsOwner(false);
        localStorage.removeItem(WALLET_CONNECTED_KEY);
      }
    };

    window.ethereum.on("chainChanged", handleChainChanged);
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [setWalletInfo, checkNetwork]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask não encontrado. Instale a extensão em metamask.io");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      localStorage.setItem(WALLET_CONNECTED_KEY, "true");
      await setWalletInfo(addr);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied") || msg.includes("4001")) {
        setError("Conexão recusada. Aprove a solicitação no MetaMask.");
      } else {
        setError("Erro ao conectar carteira. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }, [setWalletInfo]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(WALLET_CONNECTED_KEY);
    setAddress(null);
    setIsOwner(false);
    setWrongNetwork(false);
    setError(null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err: unknown) {
      // Código 4902 = rede não cadastrada no MetaMask — adiciona automaticamente
      if ((err as { code?: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
  }, []);

  return { address, isOwner, ownerLoading, loading, wrongNetwork, connect, disconnect, switchToSepolia, error };
}

// ─── Governança ────────────────────────────────────────────────────────────

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!GOVERNANCE_ADDRESS) { setProposals([]); return; }
    try {
      setLoading(true);
      const data = await getAllProposals();
      setProposals([...data]);
    } catch {
      setError("Erro ao carregar propostas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { proposals, loading, error, refetch: fetch };
}

export function useTokenBalance(address: string | null) {
  const [balance, setBalance]   = useState<bigint>(0n);
  const [supply, setSupply]     = useState<bigint>(0n);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!address || !TOKEN_ADDRESS) { setBalance(0n); return; }
    setLoading(true);
    Promise.all([getTokenBalance(address), getTokenTotalSupply()])
      .then(([bal, sup]) => { setBalance(bal); setSupply(sup); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  return { balance, supply, loading };
}

export function useHasVoted(proposalId: bigint | null, voter: string | null) {
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (!proposalId || !voter || !GOVERNANCE_ADDRESS) { setVoted(false); return; }
    hasVotedOn(proposalId, voter)
      .then(setVoted)
      .catch(() => {});
  }, [proposalId, voter]);

  return voted;
}
