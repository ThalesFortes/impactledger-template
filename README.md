# GreenTrace — Rastreabilidade de Impacto Social On-Chain

> Plataforma blockchain para registro, rastreamento e certificação de ações de impacto social com auditabilidade pública e imutável.

---

## O Problema

Bilhões de reais são movimentados anualmente em fundos sociais, projetos ESG e iniciativas de impacto no Brasil — mas a prestação de contas ainda depende de planilhas, PDFs e da boa vontade de quem gerencia os recursos.

- Doadores não conseguem verificar se o dinheiro chegou ao destino
- ONGs perdem credibilidade por falta de transparência comprovável
- Empresas não conseguem provar impacto real para relatórios ESG e certificações

## A Solução

GreenTrace registra cada centavo gasto em fundos sociais diretamente na blockchain. Cada gasto vira um registro **imutável, público e auditável por qualquer pessoa** — sem precisar confiar em intermediários.

```
Fundo criado → Gasto registrado → Evidência no IPFS → NFT emitido → Qualquer pessoa audita
```

---

## Aplicação Publicada

**https://impact-ledger.vercel.app**

---

## Acesso Demo — Painel Administrativo

Para testar o painel de gestão completo, importe esta carteira no MetaMask:

```
Chave privada: 0x8a3bef974e11393ec1c2c9ca4350f11ad3a536a3d0fbf9d533de96877f8eff0d
Endereço:      0x871A2dE4748784b259BBD8ED203cb932A0E68d2e
Rede:          Sepolia Testnet (Chain ID: 11155111)
```

> ⚠️ Carteira exclusiva para demonstração — Sepolia testnet, sem valor real.

**Como importar:**
1. MetaMask → ícone de conta → "Add account or hardware wallet" → "Import account"
2. Cole a chave privada acima e confirme
3. Certifique-se de estar na rede Sepolia
4. Acesse a aplicação e clique em "Conectar Carteira"

---

## Contratos Deployados — Sepolia Testnet

| Contrato | Endereço | Etherscan |
|----------|----------|-----------|
| GreenTrace (principal) | `0x26902aC21348d3b2fF246E45BB6Cc6523dCdfEE3` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x26902aC21348d3b2fF246E45BB6Cc6523dCdfEE3) |
| ImpactToken (ERC20Votes) | `0xf4AF177BF1298341F7ed8f70F36B277E1B630240` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0xf4AF177BF1298341F7ed8f70F36B277E1B630240) |
| ImpactGovernance (DAO) | `0x11EE0b68Cb1b226943B401D060ef61d3B1d4a568` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x11EE0b68Cb1b226943B401D060ef61d3B1d4a568) |

**Deployer:** `0x871A2dE4748784b259BBD8ED203cb932A0E68d2e`  
**Deploy em:** 2026-06-04 — Sepolia Testnet

---

## Fluxo Principal

```
1. Admin cria um Fundo de Impacto (ex: "Fundo Alimentação 2026")
        ↓
2. Admin registra um Gasto com:
   - Descrição, valor em ETH e valor em BRL
   - Endereço do beneficiário
   - Evidência (PDF/imagem) enviada ao IPFS via Pinata
        ↓
3. GreenTrace emite automaticamente um NFT-certificado on-chain
   com SVG gerado inteiramente no contrato (sem dependência externa)
        ↓
4. Beneficiário confirma o recebimento diretamente on-chain
        ↓
5. Auditor valida a despesa (quando configurado)
        ↓
6. Qualquer pessoa acessa a URL pública e verifica:
   → o gasto no Etherscan
   → a evidência no IPFS
   → o certificado NFT
```

---

## O que fica On-Chain vs Off-Chain

| Dado | Onde fica | Por quê |
|------|-----------|---------|
| Nome do fundo, categoria, valor total | **On-chain** | Imutável, auditável |
| Valor gasto, beneficiário, timestamp | **On-chain** | Prova de execução |
| Hash IPFS da evidência | **On-chain** | Vincula o documento ao registro |
| Métricas de impacto (beneficiários, ODS) | **On-chain** | Rastreabilidade completa |
| NFT-certificado (SVG completo) | **On-chain** | Sem dependência de servidor externo |
| PDF/imagem da nota fiscal | **IPFS** | Custo de gas inviável on-chain |

---

## Arquitetura

```
┌──────────────────────────────────────────────┐
│             Frontend (Next.js 15)             │
│           Vercel  ·  ethers.js v6             │
└─────────────────────┬────────────────────────┘
                      │ MetaMask
         ┌────────────▼─────────────┐
         │      Sepolia Testnet      │
         │                           │
         │  ┌─────────────────────┐ │
         │  │     GreenTrace      │ │  ERC721 + Ownable + ReentrancyGuard
         │  │    (principal)      │ │  Fundos · Gastos · NFTs · Auditor
         │  └──────────┬──────────┘ │
         │             │             │
         │  ┌──────────▼──────────┐ │
         │  │    ImpactToken      │ │  ERC20Votes
         │  │   (governança)      │ │  Mintado por gasto confirmado
         │  └──────────┬──────────┘ │
         │             │             │
         │  ┌──────────▼──────────┐ │
         │  │  ImpactGovernance   │ │  DAO · Propostas · Votação
         │  │       (DAO)         │ │  Snapshot anti-double voting
         │  └─────────────────────┘ │
         └───────────────────────────┘
                      │
         ┌────────────▼─────────────┐
         │     IPFS via Pinata       │
         │  Evidências das ações     │
         └───────────────────────────┘
```

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Smart Contracts | Solidity 0.8.24 |
| Framework | Hardhat |
| Padrões | OpenZeppelin (ERC721, ERC20Votes, Ownable, ReentrancyGuard) |
| Rede | Sepolia Testnet |
| Carteira | MetaMask |
| Armazenamento descentralizado | IPFS via Pinata |
| Frontend | Next.js 15 + React 19 |
| Interação blockchain | ethers.js v6 |
| Deploy frontend | Vercel |

---

## Diferenciais Técnicos

- **NFT com SVG 100% on-chain** — certificado gerado inteiramente pelo contrato, sem servidor
- **ERC20Votes + snapshot por bloco** — governança segura, sem possibilidade de double voting
- **ReentrancyGuard** no fluxo de confirmação — proteção contra ataques de reentrância
- **Escape XML/JSON no SVG on-chain** — prevenção de injeção de código
- **Fluxo de auditoria opcional** — validação por auditor externo antes da confirmação final
- **Métricas ODS** — alinhamento com os 17 Objetivos de Desenvolvimento Sustentável da ONU
- **Valor em BRL + ETH** — cada gasto registra o equivalente em reais para prestação de contas local

---

## Como Executar Localmente

### Pré-requisitos
- Node.js 18+
- MetaMask instalado no browser
- ETH na Sepolia — obtenha em [sepoliafaucet.com](https://sepoliafaucet.com)

### 1. Instalar dependências

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env`:
```
PRIVATE_KEY=sua_chave_privada
SEPOLIA_RPC_URL=https://rpc.sepolia.org
ETHERSCAN_API_KEY=opcional
```

```bash
cp frontend/.env.local.example frontend/.env.local
```

Edite `frontend/.env.local` com os endereços dos contratos e o JWT da Pinata.

### 3. Rodar o frontend

```bash
npm run frontend:dev
# Acesse http://localhost:3000
```

### 4. (Opcional) Deploy próprio dos contratos

```bash
npm run deploy:sepolia
```

Deploya os 3 contratos, configura entre si, copia ABIs e atualiza o `.env.local` automaticamente.

---

## Scripts Disponíveis

```bash
npm run deploy:sepolia      # Deploy completo na Sepolia
npm run configure           # Reconfigurar contratos já deployados
npm run sync-env            # Sincronizar endereços com o frontend
npm run frontend:dev        # Frontend em desenvolvimento
npm run frontend:build      # Build de produção
npm test                    # Testes Hardhat
```

---

## Estrutura do Repositório

```
impactLedger/
├── contracts/
│   ├── GreenTrace.sol          # Contrato principal — fundos, gastos, NFTs
│   ├── ImpactToken.sol         # ERC20Votes — token de governança
│   └── ImpactGovernance.sol    # DAO — propostas e votação
├── scripts/
│   ├── deploy.js               # Deploy dos 3 contratos em sequência
│   ├── configure.js            # Configuração pós-deploy
│   └── sync-env.js             # Sincroniza endereços no frontend
├── deployments/
│   └── sepolia.json            # Endereços deployados (gerado automaticamente)
├── frontend/
│   └── src/
│       ├── app/                # Páginas Next.js (/, /admin, /fundos/*)
│       ├── components/         # Componentes React
│       └── lib/                # Hooks, funções de contrato, ABIs
└── hardhat.config.js
```

---

## Potencial de Mercado

- **R$ 23 bilhões/ano** movimentados em fundos sociais privados no Brasil
- **ESG obrigatório** para empresas listadas na B3 desde 2023
- **US$ 1,1 trilhão** em impact investing globalmente (GIIN, 2023)

**Modelo de negócio SaaS B2B:** R$ 300–800/mês por organização  

**Roadmap:**
- Login sem MetaMask (Privy — Google/email com carteira invisível)
- Multi-tenant com Factory contract (cada empresa deploya seus próprios contratos)
- Migração para Polygon (gas < R$ 0,01 por transação, invisível para o usuário)
- Integração PIX/Open Finance para rastreamento fiat

---

## Requisitos do Hackathon Atendidos

| Requisito | Como é atendido |
|-----------|-----------------|
| Uso de blockchain | Contratos deployados na Sepolia; todas as ações são transações on-chain verificáveis |
| Registro de ações de impacto | Cada gasto gera NFT (ERC-721) com metadados imutáveis gravados no contrato |
| Smart contracts funcionais | Três contratos em produção: GreenTrace, ImpactToken, ImpactGovernance |
| Histórico auditável | Todo o histórico é público e consultável no Etherscan sem acesso ao sistema |
| Evidências vinculadas | Hash IPFS gravado on-chain vincula cada comprovante ao seu registro |
| Certificado/NFT automático | NFT emitido automaticamente após confirmação, SVG 100% on-chain |
| Métricas de impacto | Beneficiários, ODS, localização e métricas registradas por gasto |
| Transparência on-chain vs off-chain | Dados estruturados on-chain; arquivos grandes no IPFS com hash vinculado |
| Frontend funcional | Next.js 15 publicado na Vercel com fluxo completo end-to-end |
| IPFS | Evidências armazenadas via Pinata com hash verificável |

---

## Licença

MIT
