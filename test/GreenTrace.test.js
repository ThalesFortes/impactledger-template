const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

describe("GreenTrace", function () {
  let contract;
  let owner;
  let beneficiary;
  let stranger;

  const ONE_ETH  = ethers.parseEther("1.0");
  const HALF_ETH = ethers.parseEther("0.5");

  // Helpers para fiat: 900000 centavos = R$ 9.000,00
  const FIAT_BRL      = 900000n;
  const FIAT_CURRENCY = "BRL";

  beforeEach(async function () {
    [owner, beneficiary, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("GreenTrace");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  // ─── createPool ────────────────────────────────────────────────────────────

  describe("createPool", function () {
    it("owner cria fundo com sucesso", async function () {
      await expect(contract.createPool("Projeto A", "Educação", ONE_ETH))
        .to.emit(contract, "PoolCreated")
        .withArgs(1, "Projeto A", "Educação", ONE_ETH, anyValue);

      const pool = await contract.getPool(1);
      expect(pool.name).to.equal("Projeto A");
      expect(pool.category).to.equal("Educação");
      expect(pool.totalAmount).to.equal(ONE_ETH);
      expect(pool.spentAmount).to.equal(0n);
      expect(pool.active).to.be.true;
    });

    it("não-owner não pode criar fundo", async function () {
      await expect(
        contract.connect(stranger).createPool("Projeto B", "Saúde", ONE_ETH)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("rejeita nome vazio", async function () {
      await expect(contract.createPool("", "Educação", ONE_ETH))
        .to.be.revertedWith("Nome obrigatorio");
    });

    it("rejeita valor zero", async function () {
      await expect(contract.createPool("Projeto C", "ESG", 0))
        .to.be.revertedWith("Valor deve ser maior que zero");
    });

    it("rejeita categoria vazia", async function () {
      await expect(contract.createPool("Projeto D", "", ONE_ETH))
        .to.be.revertedWith("Categoria obrigatoria");
    });
  });

  // ─── registerExpenditure ──────────────────────────────────────────────────

  describe("registerExpenditure", function () {
    beforeEach(async function () {
      await contract.createPool("Fundo ESG", "Meio Ambiente", ONE_ETH);
    });

    it("registra gasto com sucesso e emite evento com campos fiat", async function () {
      await expect(
        contract.registerExpenditure(1, "Compra de mudas", HALF_ETH, beneficiary.address, "", FIAT_BRL, FIAT_CURRENCY)
      )
        .to.emit(contract, "ExpenditureRegistered")
        .withArgs(1, 1, "Compra de mudas", HALF_ETH, beneficiary.address, "", FIAT_BRL, FIAT_CURRENCY, anyValue);

      const pool = await contract.getPool(1);
      expect(pool.spentAmount).to.equal(HALF_ETH);
    });

    it("registra gasto sem fiat (campos opcionais zerados)", async function () {
      await contract.registerExpenditure(1, "Compra", HALF_ETH, beneficiary.address, "", 0n, "");
      const exp = await contract.getExpenditure(1);
      expect(exp.fiatAmountCents).to.equal(0n);
      expect(exp.fiatCurrency).to.equal("");
    });

    it("campos fiat são salvos corretamente", async function () {
      await contract.registerExpenditure(1, "Gasto BRL", HALF_ETH, beneficiary.address, "", FIAT_BRL, FIAT_CURRENCY);
      const exp = await contract.getExpenditure(1);
      expect(exp.fiatAmountCents).to.equal(FIAT_BRL);
      expect(exp.fiatCurrency).to.equal(FIAT_CURRENCY);
    });

    it("não-owner não pode registrar gasto", async function () {
      await expect(
        contract.connect(stranger).registerExpenditure(1, "Fraude", HALF_ETH, beneficiary.address, "", 0n, "")
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("rejeita fundo inexistente", async function () {
      await expect(
        contract.registerExpenditure(99, "Gasto", HALF_ETH, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Fundo nao existe");
    });

    it("rejeita gasto que ultrapassa o total do fundo", async function () {
      const excesso = ethers.parseEther("2.0");
      await expect(
        contract.registerExpenditure(1, "Gasto excessivo", excesso, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Gasto ultrapassa o total do fundo");
    });

    it("acumula múltiplos gastos corretamente", async function () {
      await contract.registerExpenditure(1, "Gasto 1", HALF_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(1, "Gasto 2", HALF_ETH, beneficiary.address, "", 0n, "");

      const pool = await contract.getPool(1);
      expect(pool.spentAmount).to.equal(ONE_ETH);
    });

    it("terceiro gasto ultrapassa saldo restante", async function () {
      await contract.registerExpenditure(1, "Gasto 1", HALF_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(1, "Gasto 2", HALF_ETH, beneficiary.address, "", 0n, "");

      await expect(
        contract.registerExpenditure(1, "Gasto 3", 1n, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Gasto ultrapassa o total do fundo");
    });

    it("rejeita beneficiário endereço zero", async function () {
      await expect(
        contract.registerExpenditure(1, "Gasto", HALF_ETH, ethers.ZeroAddress, "", 0n, "")
      ).to.be.revertedWith("Beneficiario invalido");
    });

    it("rejeita descrição vazia", async function () {
      await expect(
        contract.registerExpenditure(1, "", HALF_ETH, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Descricao obrigatoria");
    });

    it("rejeita valor zero", async function () {
      await expect(
        contract.registerExpenditure(1, "Gasto", 0n, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Valor deve ser maior que zero");
    });
  });

  // ─── confirmReceipt + NFT ─────────────────────────────────────────────────

  describe("confirmReceipt", function () {
    beforeEach(async function () {
      await contract.createPool("Fundo Social", "Saúde", ONE_ETH);
      await contract.registerExpenditure(1, "Medicamentos", HALF_ETH, beneficiary.address, "QmHash123", FIAT_BRL, FIAT_CURRENCY);
    });

    it("beneficiário confirma recebimento e emite eventos corretos", async function () {
      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.emit(contract, "ReceiptConfirmed")
        .withArgs(1, beneficiary.address, anyValue)
        .and.to.emit(contract, "CertificateIssued")
        .withArgs(1, 1, beneficiary.address);

      const exp = await contract.getExpenditure(1);
      expect(exp.confirmedByBeneficiary).to.be.true;
    });

    it("minta NFT para o beneficiário após confirmação", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);

      expect(await contract.ownerOf(1)).to.equal(beneficiary.address);
      expect(await contract.balanceOf(beneficiary.address)).to.equal(1n);
    });

    it("certificateTokenId é salvo no expenditure", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);

      const exp = await contract.getExpenditure(1);
      expect(exp.certificateTokenId).to.equal(1n);
    });

    it("tokenURI retorna metadata base64 válida", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);

      const uri = await contract.tokenURI(1);
      expect(uri).to.include("data:application/json;base64,");

      const base64 = uri.replace("data:application/json;base64,", "");
      const decoded = Buffer.from(base64, "base64").toString("utf8");
      const metadata = JSON.parse(decoded);

      expect(metadata.name).to.equal("GreenTrace Certificate #1");
      expect(metadata.image).to.include("data:image/svg+xml;base64,");
      expect(metadata.attributes).to.be.an("array");

      const categoryAttr = metadata.attributes.find((a) => a.trait_type === "Categoria");
      expect(categoryAttr.value).to.equal("Saúde");
    });

    it("múltiplas confirmações geram tokens distintos", async function () {
      await contract.registerExpenditure(1, "Cirurgia", HALF_ETH, stranger.address, "", 0n, "");
      await contract.connect(beneficiary).confirmReceipt(1);
      await contract.connect(stranger).confirmReceipt(2);

      expect(await contract.ownerOf(1)).to.equal(beneficiary.address);
      expect(await contract.ownerOf(2)).to.equal(stranger.address);
      expect(await contract.totalCertificates()).to.equal(2n);
    });

    it("terceiro não pode confirmar", async function () {
      await expect(contract.connect(stranger).confirmReceipt(1))
        .to.be.revertedWith("Apenas o beneficiario pode confirmar");
    });

    it("não pode confirmar duas vezes", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);
      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.be.revertedWith("Ja confirmado");
    });

    it("confirmedAt é salvo com o timestamp da confirmação", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);
      const exp = await contract.getExpenditure(1);
      expect(exp.confirmedAt).to.be.gt(0n);
      expect(exp.confirmedAt).to.be.gte(exp.timestamp);
    });

    it("tokenURI(0) reverte", async function () {
      await expect(contract.tokenURI(0)).to.be.revertedWith("Token inexistente");
    });

    it("tokenURI de token não mintado reverte", async function () {
      await expect(contract.tokenURI(99)).to.be.revertedWith("Token inexistente");
    });

    it("confirmReceipt em gasto inexistente reverte", async function () {
      await expect(contract.connect(beneficiary).confirmReceipt(99))
        .to.be.revertedWith("Gasto nao existe");
    });
  });

  // ─── Auditor independente ─────────────────────────────────────────────────

  describe("auditor", function () {
    beforeEach(async function () {
      await contract.createPool("Fundo Auditado", "ESG", ONE_ETH);
      await contract.registerExpenditure(1, "Gasto auditável", HALF_ETH, beneficiary.address, "", FIAT_BRL, FIAT_CURRENCY);
    });

    it("owner define auditor com sucesso", async function () {
      await expect(contract.setAuditor(stranger.address))
        .to.emit(contract, "AuditorSet")
        .withArgs(stranger.address);

      expect(await contract.getAuditor()).to.equal(stranger.address);
    });

    it("auditor valida gasto com sucesso", async function () {
      await contract.setAuditor(stranger.address);

      await expect(contract.connect(stranger).validateExpenditure(1))
        .to.emit(contract, "ExpenditureValidated")
        .withArgs(1, stranger.address, anyValue);

      expect(await contract.isAuditValidated(1)).to.be.true;
    });

    it("não-auditor não pode validar", async function () {
      await contract.setAuditor(stranger.address);

      await expect(contract.connect(beneficiary).validateExpenditure(1))
        .to.be.revertedWith("Apenas o auditor");
    });

    it("gasto sem auditor definido não pode ser validado", async function () {
      await expect(contract.connect(stranger).validateExpenditure(1))
        .to.be.revertedWith("Apenas o auditor");
    });

    it("não pode validar duas vezes", async function () {
      await contract.setAuditor(stranger.address);
      await contract.connect(stranger).validateExpenditure(1);

      await expect(contract.connect(stranger).validateExpenditure(1))
        .to.be.revertedWith("Ja validado pelo auditor");
    });

    it("não pode validar gasto inexistente", async function () {
      await contract.setAuditor(stranger.address);

      await expect(contract.connect(stranger).validateExpenditure(99))
        .to.be.revertedWith("Gasto nao existe");
    });

    it("isAuditValidated retorna false antes da validação", async function () {
      expect(await contract.isAuditValidated(1)).to.be.false;
    });

    it("setAuditor com endereço zero reverte", async function () {
      await expect(contract.setAuditor(ethers.ZeroAddress))
        .to.be.revertedWith("Auditor invalido");
    });

    it("não-owner não pode definir auditor", async function () {
      await expect(contract.connect(stranger).setAuditor(beneficiary.address))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("com auditor configurado, confirmReceipt reverte se gasto não validado", async function () {
      await contract.setAuditor(stranger.address);

      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.be.revertedWith("Aguardando validacao do auditor");
    });

    it("com auditor configurado, confirmReceipt sucede após validateExpenditure", async function () {
      await contract.setAuditor(stranger.address);
      await contract.connect(stranger).validateExpenditure(1);

      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.emit(contract, "CertificateIssued")
        .withArgs(1, anyValue, beneficiary.address);

      expect(await contract.isAuditValidated(1)).to.be.true;
      const exp = await contract.getExpenditure(1);
      expect(exp.confirmedByBeneficiary).to.be.true;
    });

    it("sem auditor configurado, confirmReceipt funciona normalmente", async function () {
      // _auditor == address(0): modo sem auditoria, comportamento anterior preservado
      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.emit(contract, "CertificateIssued");
    });

    it("removeAuditor zera o auditor e emite AuditorSet(address(0))", async function () {
      await contract.setAuditor(stranger.address);
      await expect(contract.removeAuditor())
        .to.emit(contract, "AuditorSet")
        .withArgs(ethers.ZeroAddress);
      expect(await contract.getAuditor()).to.equal(ethers.ZeroAddress);
    });

    it("após removeAuditor, confirmReceipt volta a funcionar sem auditoria", async function () {
      await contract.setAuditor(stranger.address);
      await contract.removeAuditor();
      await expect(contract.connect(beneficiary).confirmReceipt(1))
        .to.emit(contract, "CertificateIssued");
    });

    it("não-owner não pode chamar removeAuditor", async function () {
      await expect(contract.connect(stranger).removeAuditor())
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe("getStats", function () {
    it("retorna estatísticas corretas com múltiplos fundos", async function () {
      await contract.createPool("Fundo A", "ESG", ONE_ETH);
      await contract.createPool("Fundo B", "Educação", ethers.parseEther("2.0"));
      await contract.registerExpenditure(1, "Gasto A", HALF_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(2, "Gasto B", ethers.parseEther("1.0"), beneficiary.address, "", 0n, "");
      await contract.registerImpact(1, 80n, "", 0n, 0n, "");

      const [totalAllocated, totalSpent, poolCount, expenditureCount, totalBeneficiaries] = await contract.getStats();
      expect(totalAllocated).to.equal(ethers.parseEther("3.0"));
      expect(totalSpent).to.equal(ethers.parseEther("1.5"));
      expect(poolCount).to.equal(2n);
      expect(expenditureCount).to.equal(2n);
      expect(totalBeneficiaries).to.equal(80n);
    });

    it("retorna zeros quando não há dados", async function () {
      const [totalAllocated, totalSpent, poolCount, expenditureCount, totalBeneficiaries] = await contract.getStats();
      expect(totalAllocated).to.equal(0n);
      expect(totalSpent).to.equal(0n);
      expect(poolCount).to.equal(0n);
      expect(expenditureCount).to.equal(0n);
      expect(totalBeneficiaries).to.equal(0n);
    });
  });

  // ─── getPools, getPoolCount e getRecentExpenditures ──────────────────────

  describe("leitura de listas", function () {
    it("getPools(0,0) retorna todos os fundos", async function () {
      await contract.createPool("Fundo 1", "ESG", ONE_ETH);
      await contract.createPool("Fundo 2", "Educação", ONE_ETH);

      const [pools, total] = await contract.getPools(0, 0);
      expect(total).to.equal(2);
      expect(pools.length).to.equal(2);
      expect(pools[0].name).to.equal("Fundo 1");
      expect(pools[1].name).to.equal("Fundo 2");
    });

    it("getPools pagina corretamente", async function () {
      await contract.createPool("Fundo 1", "ESG", ONE_ETH);
      await contract.createPool("Fundo 2", "Educação", ONE_ETH);
      await contract.createPool("Fundo 3", "Saúde", ONE_ETH);

      const [page1, total] = await contract.getPools(0, 2);
      expect(total).to.equal(3);
      expect(page1.length).to.equal(2);
      expect(page1[0].name).to.equal("Fundo 1");

      const [page2] = await contract.getPools(2, 2);
      expect(page2.length).to.equal(1);
      expect(page2[0].name).to.equal("Fundo 3");
    });

    it("getPools com offset além do total retorna array vazio", async function () {
      await contract.createPool("Fundo 1", "ESG", ONE_ETH);
      const [pools, total] = await contract.getPools(99, 10);
      expect(total).to.equal(1);
      expect(pools.length).to.equal(0);
    });

    it("getPoolCount retorna o número de fundos", async function () {
      expect(await contract.getPoolCount()).to.equal(0);
      await contract.createPool("F1", "ESG", ONE_ETH);
      await contract.createPool("F2", "ESG", ONE_ETH);
      expect(await contract.getPoolCount()).to.equal(2);
    });

    it("getRecentExpenditures retorna os mais recentes", async function () {
      await contract.createPool("Fundo", "ESG", ethers.parseEther("10.0"));
      await contract.registerExpenditure(1, "Gasto 1", ONE_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(1, "Gasto 2", ONE_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(1, "Gasto 3", ONE_ETH, beneficiary.address, "", 0n, "");

      const recent = await contract.getRecentExpenditures(2);
      expect(recent.length).to.equal(2);
      expect(recent[0].description).to.equal("Gasto 3");
      expect(recent[1].description).to.equal("Gasto 2");
    });

    it("getRecentExpenditures com limit maior que o total retorna todos", async function () {
      await contract.createPool("Fundo", "ESG", ethers.parseEther("10.0"));
      await contract.registerExpenditure(1, "Gasto 1", ONE_ETH, beneficiary.address, "", 0n, "");
      await contract.registerExpenditure(1, "Gasto 2", ONE_ETH, beneficiary.address, "", 0n, "");

      const recent = await contract.getRecentExpenditures(100);
      expect(recent.length).to.equal(2);
    });

    it("getPool com id inexistente reverte", async function () {
      await expect(contract.getPool(99)).to.be.revertedWith("Fundo nao existe");
    });

    it("getExpenditure com id inexistente reverte", async function () {
      await expect(contract.getExpenditure(99)).to.be.revertedWith("Gasto nao existe");
    });
  });

  // ─── deactivatePool ───────────────────────────────────────────────────────

  describe("deactivatePool", function () {
    beforeEach(async function () {
      await contract.createPool("Fundo Ativo", "ESG", ONE_ETH);
    });

    it("owner desativa fundo com sucesso", async function () {
      await expect(contract.deactivatePool(1))
        .to.emit(contract, "PoolDeactivated")
        .withArgs(1, anyValue);

      const pool = await contract.getPool(1);
      expect(pool.active).to.be.false;
    });

    it("não-owner não pode desativar fundo", async function () {
      await expect(contract.connect(stranger).deactivatePool(1))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("fundo inativo não aceita novos gastos", async function () {
      await contract.deactivatePool(1);
      await expect(
        contract.registerExpenditure(1, "Gasto", HALF_ETH, beneficiary.address, "", 0n, "")
      ).to.be.revertedWith("Fundo inativo");
    });

    it("desativar fundo já inativo reverte", async function () {
      await contract.deactivatePool(1);
      await expect(contract.deactivatePool(1)).to.be.revertedWith("Fundo ja inativo");
    });

    it("desativar fundo inexistente reverte", async function () {
      await expect(contract.deactivatePool(99)).to.be.revertedWith("Fundo nao existe");
    });
  });

  // ─── registerImpact ───────────────────────────────────────────────────────

  describe("registerImpact", function () {
    beforeEach(async function () {
      await contract.createPool("Fundo Floresta", "Meio Ambiente", ONE_ETH);
      await contract.registerExpenditure(1, "Reflorestamento", HALF_ETH, beneficiary.address, "", FIAT_BRL, FIAT_CURRENCY);
    });

    it("registra impacto com sucesso e emite evento", async function () {
      await expect(
        contract.registerImpact(1, 150n, "mudas", 2000n, 2500n, "Zona Norte, SP")
      )
        .to.emit(contract, "ImpactReported")
        .withArgs(1, 150n, "mudas", 2000n, 2500n, "Zona Norte, SP", anyValue);

      const report = await contract.getImpactReport(1);
      expect(report.beneficiariesCount).to.equal(150n);
      expect(report.metric).to.equal("mudas");
      expect(report.metricValue).to.equal(2000n);
      expect(report.metricGoal).to.equal(2500n);
      expect(report.location).to.equal("Zona Norte, SP");
      expect(report.reportedAt).to.be.gt(0n);
    });

    it("registra impacto sem indicador (apenas beneficiados)", async function () {
      await contract.registerImpact(1, 50n, "", 0n, 0n, "");
      const report = await contract.getImpactReport(1);
      expect(report.beneficiariesCount).to.equal(50n);
      expect(report.metric).to.equal("");
    });

    it("incrementa totalBeneficiaries no getStats", async function () {
      await contract.registerExpenditure(1, "Outro gasto", HALF_ETH, stranger.address, "", 0n, "");
      await contract.registerImpact(1, 100n, "", 0n, 0n, "");
      await contract.registerImpact(2, 50n,  "", 0n, 0n, "");

      const [,,,, totalBeneficiaries] = await contract.getStats();
      expect(totalBeneficiaries).to.equal(150n);
    });

    it("gasto inexistente reverte", async function () {
      await expect(
        contract.registerImpact(99, 10n, "", 0n, 0n, "")
      ).to.be.revertedWith("Gasto nao existe");
    });

    it("beneficiados zero reverte", async function () {
      await expect(
        contract.registerImpact(1, 0n, "mudas", 100n, 0n, "")
      ).to.be.revertedWith("Informe ao menos 1 beneficiado");
    });

    it("não-owner não pode registrar impacto", async function () {
      await expect(
        contract.connect(stranger).registerImpact(1, 10n, "", 0n, 0n, "")
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("segundo registro no mesmo gasto reverte (imutável)", async function () {
      await contract.registerImpact(1, 100n, "mudas", 500n, 0n, "");
      await expect(
        contract.registerImpact(1, 200n, "árvores", 300n, 0n, "")
      ).to.be.revertedWith("Impacto ja registrado");
    });

    it("getImpactReport retorna vazio para gasto sem relatório", async function () {
      const report = await contract.getImpactReport(1);
      expect(report.reportedAt).to.equal(0n);
      expect(report.beneficiariesCount).to.equal(0n);
    });
  });

  // ─── Oráculo Chainlink (MockV3Aggregator) ────────────────────────────────

  describe("oracle ETH/USD", function () {
    let mockFeed;
    // ETH/USD $2 000 com 8 decimals = 200_000_000_000
    const ETH_PRICE_8DEC = 200_000_000_000n;

    beforeEach(async function () {
      await contract.createPool("Fundo Oracle", "ESG", ONE_ETH);
      mockFeed = await ethers.deployContract("MockV3Aggregator", [8, ETH_PRICE_8DEC]);
      await mockFeed.waitForDeployment();
      await contract.setPriceFeed(mockFeed.target);
    });

    it("setPriceFeed emite evento e armazena endereço", async function () {
      const feed2 = await ethers.deployContract("MockV3Aggregator", [8, ETH_PRICE_8DEC]);
      await feed2.waitForDeployment();

      await expect(contract.setPriceFeed(feed2.target))
        .to.emit(contract, "PriceFeedSet")
        .withArgs(feed2.target);

      expect(await contract.getPriceFeed()).to.equal(feed2.target);
    });

    it("aceita gasto USD dentro da tolerância (0.5 ETH @ $2000 = $1000)", async function () {
      // 0.5 ETH × $2000 = $1000 → fiatCents = 100_000
      await expect(
        contract.registerExpenditure(1, "Gasto USD válido", HALF_ETH, beneficiary.address, "", 100_000n, "USD")
      ).to.not.be.reverted;
    });

    it("aceita valor dentro de +30% de tolerância", async function () {
      // +29%: $1290 em cents = 129_000 (< limite de 130_000)
      await expect(
        contract.registerExpenditure(1, "Acima +29", HALF_ETH, beneficiary.address, "", 129_000n, "USD")
      ).to.not.be.reverted;
    });

    it("aceita valor dentro de -30% de tolerância", async function () {
      // -29%: $710 em cents = 71_000 (> limite de 70_000)
      await expect(
        contract.registerExpenditure(1, "Abaixo -29", HALF_ETH, beneficiary.address, "", 71_000n, "USD")
      ).to.not.be.reverted;
    });

    it("rejeita valor USD fora da tolerância (mais de +30%)", async function () {
      // +31%: $1310 em cents = 131_000 → acima de 130_000
      await expect(
        contract.registerExpenditure(1, "Divergente alto", HALF_ETH, beneficiary.address, "", 131_000n, "USD")
      ).to.be.revertedWith("Oraculo: valor ETH diverge do USD declarado (+/-30%)");
    });

    it("rejeita valor USD fora da tolerância (menos de -30%)", async function () {
      // $600 seria -40% → fora dos 30%
      await expect(
        contract.registerExpenditure(1, "Divergente baixo", HALF_ETH, beneficiary.address, "", 60_000n, "USD")
      ).to.be.revertedWith("Oraculo: valor ETH diverge do USD declarado (+/-30%)");
    });

    it("ignora validação para moeda BRL (não USD)", async function () {
      // BRL não é validado pelo oráculo ETH/USD
      await expect(
        contract.registerExpenditure(1, "Gasto BRL", HALF_ETH, beneficiary.address, "", 5_000_000n, "BRL")
      ).to.not.be.reverted;
    });

    it("ignora validação quando fiatAmountCents = 0", async function () {
      await expect(
        contract.registerExpenditure(1, "Sem fiat", HALF_ETH, beneficiary.address, "", 0n, "USD")
      ).to.not.be.reverted;
    });

    it("rejeita dados do oráculo desatualizados (> 1 hora)", async function () {
      // Força timestamp desatualizado no mock
      const stale = (await ethers.provider.getBlock("latest")).timestamp - 3601;
      await mockFeed.setUpdatedAt(stale);

      await expect(
        contract.registerExpenditure(1, "Stale oracle", HALF_ETH, beneficiary.address, "", 100_000n, "USD")
      ).to.be.revertedWith("Oraculo: dados desatualizados");
    });

    it("sem oracle configurado, USD passa sem validação", async function () {
      await contract.setPriceFeed(ethers.ZeroAddress);
      await expect(
        contract.registerExpenditure(1, "Sem oracle", HALF_ETH, beneficiary.address, "", 999_999n, "USD")
      ).to.not.be.reverted;
    });
  });

  // ─── IMPACT Token — mint automático via confirmação ──────────────────────

  describe("IMPACT token — mint na confirmação", function () {
    let token;

    beforeEach(async function () {
      token = await ethers.deployContract("ImpactToken");
      await token.waitForDeployment();
      // Transfere ownership para o contrato poder mintar
      await token.transferOwnership(contract.target);
      await contract.setToken(token.target);

      await contract.createPool("Fundo Token", "ESG", ONE_ETH);
      await contract.registerExpenditure(1, "Gasto com token", HALF_ETH, beneficiary.address, "", 0n, "");
    });

    it("setToken emite evento e armazena endereço", async function () {
      // Cria novo contrato sem token para testar o setter
      const contract2 = await ethers.deployContract("GreenTrace");
      await contract2.waitForDeployment();
      await expect(contract2.setToken(token.target))
        .to.emit(contract2, "TokenSet")
        .withArgs(token.target);
      expect(await contract2.getToken()).to.equal(token.target);
    });

    it("confirmação de recebimento minta IMPACT tokens ao beneficiário", async function () {
      await contract.connect(beneficiary).confirmReceipt(1);
      const balance = await token.balanceOf(beneficiary.address);
      // 0.5 ETH = 5e17 wei → 5e17 / 1e15 = 500 tokens (em unidades)
      // com decimals 18: 500 × 1e18
      const expectedUnits = 500n;
      const expectedWei   = expectedUnits * (10n ** 18n);
      expect(balance).to.equal(expectedWei);
    });

    it("saldo de tokens é proporcional ao valor recebido", async function () {
      // Gasto 2: 1 ETH → 1000 tokens
      await contract.registerExpenditure(1, "Gasto grande", HALF_ETH, stranger.address, "", 0n, "");
      await contract.connect(stranger).confirmReceipt(2);
      const balance = await token.balanceOf(stranger.address);
      const expectedWei = 500n * (10n ** 18n);
      expect(balance).to.equal(expectedWei);
    });

    it("sem token configurado, confirmação funciona normalmente sem mint", async function () {
      const contract2 = await ethers.deployContract("GreenTrace");
      await contract2.waitForDeployment();
      await contract2.createPool("F", "ESG", ONE_ETH);
      await contract2.registerExpenditure(1, "G", HALF_ETH, beneficiary.address, "", 0n, "");
      // Não deve reverter mesmo sem token
      await expect(contract2.connect(beneficiary).confirmReceipt(1)).to.not.be.reverted;
    });
  });

  // ─── Governança — integração com GreenTrace ─────────────────────────────

  describe("setGovernance + setAuditorByGovernance", function () {
    it("setGovernance emite evento e armazena endereço", async function () {
      await expect(contract.setGovernance(stranger.address))
        .to.emit(contract, "GovernanceSet")
        .withArgs(stranger.address);
      expect(await contract.getGovernance()).to.equal(stranger.address);
    });

    it("setGovernance com endereço zero reverte", async function () {
      await expect(contract.setGovernance(ethers.ZeroAddress))
        .to.be.revertedWith("Governanca invalida");
    });

    it("não-owner não pode setar governança", async function () {
      await expect(contract.connect(stranger).setGovernance(stranger.address))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("governança definida pode chamar setAuditorByGovernance", async function () {
      // Simula governança sendo o endereço 'stranger'
      await contract.setGovernance(stranger.address);
      await expect(contract.connect(stranger).setAuditorByGovernance(beneficiary.address))
        .to.emit(contract, "AuditorSet")
        .withArgs(beneficiary.address);
      expect(await contract.getAuditor()).to.equal(beneficiary.address);
    });

    it("sem governança definida, setAuditorByGovernance reverte", async function () {
      await expect(contract.connect(stranger).setAuditorByGovernance(beneficiary.address))
        .to.be.revertedWith("Apenas a governanca");
    });

    it("setAuditorByGovernance com endereço zero reverte", async function () {
      await contract.setGovernance(stranger.address);
      await expect(contract.connect(stranger).setAuditorByGovernance(ethers.ZeroAddress))
        .to.be.revertedWith("Auditor invalido");
    });
  });
});
