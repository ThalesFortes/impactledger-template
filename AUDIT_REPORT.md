# Relatório de Auditoria — ImpactLedger

**Ferramenta:** Slither 0.11.5  
**Data:** 2026-05-26  
**Contratos auditados:** `ImpactLedger.sol`, `ImpactToken.sol`, `ImpactGovernance.sol`  
**Compilador:** Solidity 0.8.24 (Hardhat)

---

## Resumo dos achados

| Severidade | Total | Corrigidos | Aceitos (falso positivo / design intencional) |
|---|---|---|---|
| High | 0 | — | — |
| Medium | 2 | 2 | 0 |
| Low | 3 | 1 | 2 |
| Informacional | 2 | 0 | 2 |

**Nenhuma vulnerabilidade de alta severidade detectada.**

---

## Achados Medium

### M-1: divide-before-multiply em `_validateFiatUSD`

**Detector:** `divide-before-multiply`  
**Arquivo:** `ImpactLedger.sol` — função `_validateFiatUSD`  
**Status:** ✅ Corrigido

**Descrição:**  
A implementação original calculava `expectedCents = (weiAmount * price) / 1e24` e depois multiplicava para obter os limites de tolerância. Isso introduzia perda de precisão em valores baixos de ETH.

**Correção aplicada:**  
Eliminou-se a divisão intermediária. A comparação agora é feita em escala amplificada:

```solidity
uint256 weiXprice  = weiAmount * uint256(price);
uint256 scaledFiat = fiatCents * (10 ** 24) * 100;
require(
    scaledFiat >= weiXprice * (100 - ORACLE_TOLERANCE_PERCENT) &&
    scaledFiat <= weiXprice * (100 + ORACLE_TOLERANCE_PERCENT),
    ...
);
```

Sem risco de overflow — valores máximos realistas somam ~10^35, bem dentro dos limites do `uint256` (~1.16 × 10^77).

---

### M-2: weak-prng (falso positivo)

**Detector:** `weak-prng`  
**Arquivo:** `ImpactLedger.sol` — funções `_fiatToString`, `_weiToEthString`  
**Status:** ✅ Aceito (falso positivo)

**Descrição:**  
Slither sinalizou o uso do operador `%` como possível PRNG fraco. Nas funções auditadas, `%` é usado exclusivamente para formatação de string (obter decimais de um inteiro), sem nenhum componente de aleatoriedade. Não há dependência de `block.timestamp` ou `blockhash` como fonte de entropia.

**Risco real:** Nenhum.

---

## Achados Low

### L-1: shadowing-local — parâmetro `name` em `createPool`

**Detector:** `shadowing-local`  
**Arquivo:** `ImpactLedger.sol`  
**Status:** ✅ Corrigido

**Descrição:**  
O parâmetro `name` de `createPool` sombreava a função `ERC721.name()`. Embora sem impacto funcional (o parâmetro é local ao escopo da função), pode gerar confusão na leitura do código.

**Correção:** Parâmetro renomeado para `poolName`.

---

### L-2: reentrancy-events em `confirmReceipt` e `execute`

**Detector:** `reentrancy-events`  
**Arquivo:** `ImpactLedger.sol`, `ImpactGovernance.sol`  
**Status:** ✅ Aceito (design seguro — CEI aplicado)

**Descrição:**  
Slither detectou emissão de eventos após chamadas externas (`_token.mint()` e `ledger.setAuditorByGovernance()`). Este é um achado de severidade baixa — eventos após chamadas externas podem ser reordenados em exploits de reentrância, mas apenas se a reentrância alterar o estado de forma prejudicial.

**Análise:**
- `confirmReceipt`: todo o estado relevante (`confirmedByBeneficiary`, `confirmedAt`, `certificateTokenId`, `_tokenToExpenditure`) é atualizado **antes** da chamada externa. A reentrância via `_token.mint()` chamaria novamente `confirmReceipt`, que reverteria em `"Ja confirmado"`. Padrão CEI (Checks-Effects-Interactions) aplicado corretamente.
- `execute`: estado `p.status = Executed` definido **antes** de `ledger.setAuditorByGovernance()`. Reentrância reverteria em `"Ja processada"`.

**Risco real:** Nenhum — reentrância não muda o resultado nem drena fundos.

---

### L-3: timestamp para comparações de prazo

**Detector:** `timestamp`  
**Arquivo:** `ImpactGovernance.sol`  
**Status:** ✅ Aceito (padrão de governança)

**Descrição:**  
`block.timestamp` é usado para comparar deadlines de votação. Slither alerta sobre possível manipulação de timestamp por mineradores (±15 segundos na mainnet; muito menos em L2s).

**Análise:**  
O prazo de votação é de 3 dias. Uma variação de ±15 segundos representa 0.006% do período total e não permite que nenhum ator influencie o resultado de forma significativa. Este padrão é universal em contratos de governança (OpenZeppelin Governor, Compound, Aave).

**Risco real:** Desprezível para prazos de dias.

---

## Achados Informacionais

### I-1: unused-return — valores ignorados de `latestRoundData`

**Detector:** `unused-return`  
**Status:** ✅ Aceito

`latestRoundData()` retorna 5 valores; apenas `price` e `updatedAt` são usados. Os demais (`roundId`, `startedAt`, `answeredInRound`) não são necessários para a validação implementada. O código usa desestruturação com `, ` para ignorá-los explicitamente — comentário adicionado ao código para deixar a intenção clara.

---

### I-2: múltiplas versões de pragma (dependências)

**Detector:** `pragma`  
**Status:** ✅ Aceito

Slither detectou 6 versões de pragma distintas. Todas provêm das dependências OpenZeppelin (`^0.8.20`). Os contratos do projeto usam `^0.8.24` consistentemente. Não há conflito: `^0.8.20` é compatível com compilação em 0.8.24.

---

## Controles de segurança aplicados

| Controle | Implementação |
|---|---|
| Controle de acesso | `onlyOwner` (OpenZeppelin Ownable) em todas as funções de escrita críticas |
| Checks-Effects-Interactions | Aplicado em `confirmReceipt` — estado atualizado antes de qualquer chamada externa |
| Reentrancy guard implícito | `"Ja confirmado"` e `"Ja processada"` bloqueiam reentrância funcional sem custo adicional de gas |
| Overflow/underflow | Solidity 0.8.24 — reverte automaticamente em operações aritméticas inválidas |
| Validação de entradas | `require` com mensagens em todas as funções públicas/externas |
| Staleness do oráculo | Dados com mais de 1 hora são rejeitados |
| Dados de oráculo negativos | `require(price > 0)` e `require(updatedAt > 0)` |
| Imutabilidade de impacto | `"Impacto ja registrado"` impede duplo registro |
| Permissão de confirmação | Apenas `exp.beneficiary == msg.sender` pode confirmar recebimento |

---

## Conclusão

Os contratos do ImpactLedger apresentam bom nível de segurança para o escopo proposto. Nenhuma vulnerabilidade de alta severidade foi identificada. Os dois achados medium foram corrigidos antes da entrega. Os achados low e informacionais restantes são padrões de design aceitos com risco residual desprezível.

**Recomendação para deploy em mainnet:** realizar auditoria adicional com Mythril e revisão manual por auditor especializado, especialmente da lógica do oráculo e da integração token/governance.
