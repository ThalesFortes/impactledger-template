# ImpactLedger

Plataforma de rastreabilidade on-chain de gastos de impacto social. Cada gasto é registrado como NFT na blockchain com evidências no IPFS, garantindo transparência, imutabilidade e auditabilidade pública.

**Stack:** Hardhat + Solidity 0.8.24, Next.js 15, ethers.js, Pinata IPFS, Sepolia testnet.

---

## Como a solução funciona

### Visão geral

O ImpactLedger resolve o problema de falta de transparência na destinação de fundos sociais. Qualquer pessoa pode verificar publicamente onde e como cada recurso foi gasto, sem depender de relatórios intermediários.

### Fluxo principal

1. **Criação de fundo** — o admin (owner do contrato) cria um fundo com nome, categoria e valor total disponível.
2. **Registro de gasto** — o admin registra um gasto vinculado a um fundo, com descrição, valor, beneficiário e hash IPFS do comprovante (nota fiscal, foto, documento).
3. **Confirmação pelo beneficiário** — o beneficiário conecta sua carteira e confirma o recebimento diretamente na blockchain.
4. **Emissão de certificado NFT** — após a confirmação, um NFT (ERC-721) é mintado automaticamente com os metadados do gasto embutidos on-chain como SVG. Esse token é a prova imutável da ação de impacto.
5. **Governança** — holders do ImpactToken (ERC-20) podem votar em propostas via DAO (ImpactGovernance).

### Por que blockchain garante a confiabilidade

- **Imutabilidade:** nenhum registro pode ser alterado ou deletado após gravado na rede.
- **Auditabilidade pública:** qualquer pessoa pode consultar o histórico completo no Etherscan, sem precisar de acesso ao sistema.
- **Verificação sem intermediário:** o beneficiário confirma o recebimento diretamente com a própria carteira — não é possível falsificar essa confirmação.
- **Certificado NFT on-chain:** os metadados do NFT (descrição, valor, beneficiário, data) ficam embutidos diretamente no contrato, não dependem de servidor externo.

### Contratos inteligentes

| Contrato | Função |
|---|---|
| `GreenTrace` (ERC-721) | Registra fundos, gastos e emite certificados NFT |
| `ImpactToken` (ERC-20Votes) | Token de governança distribuído aos participantes |
| `ImpactGovernance` | DAO para votação de propostas usando snapshot anti-double voting |

---

## Pré-requisitos

- Node.js 18+
- MetaMask (ou outra carteira EVM)
- ETH na Sepolia — obtenha em [sepoliafaucet.com](https://sepoliafaucet.com) ou [faucet.quicknode.com/ethereum/sepolia](https://faucet.quicknode.com/ethereum/sepolia)
- Conta na [Pinata](https://app.pinata.cloud) (plano gratuito, 1 GB) para upload de comprovantes

---

## Setup

### 1. Instalar dependências

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configurar variáveis de ambiente do Hardhat

Copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Edite `.env`:

```
PRIVATE_KEY=sua_chave_privada_da_carteira_deployer
SEPOLIA_RPC_URL=https://rpc.sepolia.org
ETHERSCAN_API_KEY=opcional_para_verificar_contrato
```

> A `PRIVATE_KEY` é a chave da carteira que vai ser **owner/admin** do contrato.
> Use uma carteira de teste — nunca a sua carteira principal.

### 3. Fazer o deploy

```bash
npm run deploy:sepolia
```

Este comando faz automaticamente:
- Deploya os 3 contratos (GreenTrace, ImpactToken, ImpactGovernance)
- Configura os contratos entre si
- Copia os ABIs para o frontend
- Atualiza `frontend/.env.local` com os endereços dos contratos

### 4. Configurar o frontend

Abra `frontend/.env.local` (criado automaticamente pelo deploy) e adicione o JWT da Pinata:

```
PINATA_JWT=seu_jwt_da_pinata
```

Para obter o JWT: [app.pinata.cloud/developers/api-keys](https://app.pinata.cloud/developers/api-keys) → gerar nova chave com permissão de upload.

### 5. Rodar o frontend

```bash
npm run frontend:dev
```

Acesse `http://localhost:3000`.

---

## Áreas do app

| Rota | Quem acessa |
|---|---|
| `/` | Qualquer visitante — visualiza fundos e gastos |
| `/admin` | Somente o **owner do contrato** — cria fundos, registra gastos, faz uploads de evidências |

A carteira que fez o deploy é automaticamente o owner. Qualquer outra carteira acessa apenas a área pública.

### Transferir o acesso admin para outra carteira

Sem mexer no código, via Etherscan:

1. Acesse o contrato GreenTrace no [Sepolia Etherscan](https://sepolia.etherscan.io)
2. Aba **Contract** → **Write Contract** → **Connect to Web3**
3. Chame `transferOwnership` com o endereço da nova carteira
4. Confirme no MetaMask

---

## Scripts disponíveis

```bash
npm run deploy:sepolia      # Deploy completo na Sepolia
npm run configure           # Reconfigurar contratos já deployados (sem redeploy)
npm run sync-env            # Sincronizar endereços do deploy com frontend/.env.local
npm run frontend:dev        # Rodar frontend em desenvolvimento
npm run frontend:build      # Build de produção do frontend
npm test                    # Rodar testes Hardhat
```

---

## Contratos

Os endereços são gerados no deploy e salvos em `deployments/sepolia.json` (não versionado).
Após o deploy, os endereços são sincronizados automaticamente no `frontend/.env.local`.

---

## Requisitos atendidos

| Requisito | Como é atendido |
|---|---|
| **Uso de blockchain** | Contratos deployados na Sepolia (rede pública Ethereum); todas as ações são transações on-chain verificáveis |
| **Registro verificável de ações de impacto** | Cada gasto gera um NFT (ERC-721) com metadados imutáveis gravados diretamente no contrato; o comprovante fica no IPFS |
| **Histórico auditável** | Todo o histórico de fundos, gastos e confirmações é público e consultável no Etherscan sem necessidade de acesso ao sistema |
| **Smart contract funcional** | Três contratos em produção na Sepolia: `GreenTrace`, `ImpactToken` e `ImpactGovernance`, com testes automatizados em Hardhat |
| **Repositório GitHub funcional** | Código versionado com `.env.example`, scripts de deploy automatizados e instruções de setup neste README |
| **Código minimamente comentado** | Contratos e funções principais contêm comentários explicando estruturas de dados, regras de negócio e decisões não óbvias |
| **README explicando o funcionamento** | Este documento descreve o fluxo completo da solução, a arquitetura dos contratos e os passos para rodar o projeto |
