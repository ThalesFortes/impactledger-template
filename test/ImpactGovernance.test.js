const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ImpactGovernance", function () {
  let token;
  let ledger;
  let governance;
  let owner;
  let voter1;
  let voter2;
  let auditorCandidate;
  let stranger;

  const THREE_DAYS = 3 * 24 * 60 * 60;
  const ONE_ETH    = ethers.parseEther("1.0");
  const HALF_ETH   = ethers.parseEther("0.5");

  beforeEach(async function () {
    [owner, voter1, voter2, auditorCandidate, stranger] = await ethers.getSigners();

    // Deploy token e ledger
    token   = await ethers.deployContract("ImpactToken");
    await token.waitForDeployment();

    ledger  = await ethers.deployContract("GreenTrace");
    await ledger.waitForDeployment();

    // Transfere ownership do token para o ledger (para mint automático)
    await token.transferOwnership(ledger.target);

    // Configura token no ledger
    await ledger.setToken(token.target);

    // Deploy governança
    governance = await ethers.deployContract("ImpactGovernance", [token.target, ledger.target]);
    await governance.waitForDeployment();

    // Registra governança no ledger
    await ledger.setGovernance(governance.target);

    // Cria fundo e gasto para gerar tokens via confirmação de recebimento
    await ledger.createPool("Fundo Gov", "ESG", ONE_ETH);
    await ledger.registerExpenditure(1, "Gasto para tokens", HALF_ETH, voter1.address, "", 0n, "");
    await ledger.registerExpenditure(1, "Gasto para tokens 2", HALF_ETH, voter2.address, "", 0n, "");

    // voter1 e voter2 confirmam e recebem IMPACT tokens
    await ledger.connect(voter1).confirmReceipt(1);
    await ledger.connect(voter2).confirmReceipt(2);
  });

  describe("configuração", function () {
    it("token e ledger definidos corretamente", async function () {
      expect(await governance.token()).to.equal(token.target);
      expect(await governance.ledger()).to.equal(ledger.target);
    });

    it("voters receberam tokens após confirmação", async function () {
      expect(await token.balanceOf(voter1.address)).to.be.gt(0n);
      expect(await token.balanceOf(voter2.address)).to.be.gt(0n);
    });

    it("rejeita construtor com endereços zero", async function () {
      await expect(
        ethers.deployContract("ImpactGovernance", [ethers.ZeroAddress, ledger.target])
      ).to.be.revertedWith("Token invalido");

      await expect(
        ethers.deployContract("ImpactGovernance", [token.target, ethers.ZeroAddress])
      ).to.be.revertedWith("Ledger invalido");
    });
  });

  describe("propose", function () {
    it("detentor de tokens cria proposta com sucesso", async function () {
      await expect(
        governance.connect(voter1).propose(auditorCandidate.address, "Candidato qualificado")
      )
        .to.emit(governance, "ProposalCreated")
        .withArgs(1n, voter1.address, auditorCandidate.address, "Candidato qualificado", anyValue, anyValue, anyValue);
      // args: id, proposer, targetAuditor, description, deadline, totalSupplyAtCreation, snapshotBlock

      expect(await governance.proposalCount()).to.equal(1n);
    });

    it("proposta armazena dados corretos", async function () {
      const txBlock = await ethers.provider.getBlockNumber();
      await governance.connect(voter1).propose(auditorCandidate.address, "Desc");
      const p = await governance.getProposal(1);

      expect(p.id).to.equal(1n);
      expect(p.proposer).to.equal(voter1.address);
      expect(p.targetAuditor).to.equal(auditorCandidate.address);
      expect(p.description).to.equal("Desc");
      expect(p.votesFor).to.equal(0n);
      expect(p.votesAgainst).to.equal(0n);
      expect(p.snapshotBlock).to.equal(BigInt(txBlock)); // block.number - 1 no bloco da tx
      expect(p.status).to.equal(0); // Active
    });

    it("sem tokens não pode propor", async function () {
      await expect(
        governance.connect(stranger).propose(auditorCandidate.address, "Fraude")
      ).to.be.revertedWith("Sem tokens de governanca");
    });

    it("rejeita auditor endereço zero", async function () {
      await expect(
        governance.connect(voter1).propose(ethers.ZeroAddress, "Sem auditor")
      ).to.be.revertedWith("Auditor invalido");
    });

    it("rejeita descrição vazia", async function () {
      await expect(
        governance.connect(voter1).propose(auditorCandidate.address, "")
      ).to.be.revertedWith("Descricao obrigatoria");
    });
  });

  describe("vote", function () {
    beforeEach(async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Proposta A");
    });

    it("voter1 vota a favor com peso correto", async function () {
      const weight = await token.balanceOf(voter1.address);
      await expect(governance.connect(voter1).vote(1, true))
        .to.emit(governance, "VoteCast")
        .withArgs(1, voter1.address, true, weight);

      const p = await governance.getProposal(1);
      expect(p.votesFor).to.equal(weight);
    });

    it("voter2 vota contra", async function () {
      const weight = await token.balanceOf(voter2.address);
      await governance.connect(voter2).vote(1, false);
      const p = await governance.getProposal(1);
      expect(p.votesAgainst).to.equal(weight);
    });

    it("não pode votar duas vezes", async function () {
      await governance.connect(voter1).vote(1, true);
      await expect(governance.connect(voter1).vote(1, true))
        .to.be.revertedWith("Ja votou nesta proposta");
    });

    it("sem tokens não pode votar", async function () {
      await expect(governance.connect(stranger).vote(1, true))
        .to.be.revertedWith("Sem poder de voto no snapshot da proposta");
    });

    it("não pode votar após prazo", async function () {
      await time.increase(THREE_DAYS + 1);
      await expect(governance.connect(voter1).vote(1, true))
        .to.be.revertedWith("Prazo de votacao encerrado");
    });

    it("hasVotedOn registra corretamente", async function () {
      expect(await governance.hasVotedOn(1, voter1.address)).to.be.false;
      await governance.connect(voter1).vote(1, true);
      expect(await governance.hasVotedOn(1, voter1.address)).to.be.true;
    });

    it("proposta inexistente reverte", async function () {
      await expect(governance.connect(voter1).vote(99, true))
        .to.be.revertedWith("Proposta inexistente");
    });
  });

  describe("execute — aprovada", function () {
    beforeEach(async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Eleger auditor");
      // voter1 e voter2 votam a favor → maioria garantida
      await governance.connect(voter1).vote(1, true);
      await governance.connect(voter2).vote(1, true);
      // Avança 3 dias para encerrar votação
      await time.increase(THREE_DAYS + 1);
    });

    it("executa proposta aprovada e emite evento", async function () {
      await expect(governance.execute(1))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(1, auditorCandidate.address);
    });

    it("auditor é atualizado no GreenTrace após execução", async function () {
      await governance.execute(1);
      expect(await ledger.getAuditor()).to.equal(auditorCandidate.address);
    });

    it("proposta fica com status Executed", async function () {
      await governance.execute(1);
      const p = await governance.getProposal(1);
      expect(p.status).to.equal(1); // Executed
    });

    it("não pode executar duas vezes", async function () {
      await governance.execute(1);
      await expect(governance.execute(1)).to.be.revertedWith("Ja processada");
    });
  });

  describe("execute — rejeitada (maioria contra)", function () {
    beforeEach(async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Proposta B");
      await governance.connect(voter1).vote(1, false);
      await governance.connect(voter2).vote(1, false);
      await time.increase(THREE_DAYS + 1);
    });

    it("emite ProposalRejected quando maioria é contra", async function () {
      await expect(governance.execute(1))
        .to.emit(governance, "ProposalRejected")
        .withArgs(1);
    });

    it("auditor não muda após rejeição", async function () {
      const auditorBefore = await ledger.getAuditor();
      await governance.execute(1);
      expect(await ledger.getAuditor()).to.equal(auditorBefore);
    });

    it("proposta fica com status Rejected", async function () {
      await governance.execute(1);
      const p = await governance.getProposal(1);
      expect(p.status).to.equal(2); // Rejected
    });
  });

  describe("execute — votação ainda ativa", function () {
    it("não pode executar antes do prazo", async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Cedo demais");
      await governance.connect(voter1).vote(1, true);
      await expect(governance.execute(1)).to.be.revertedWith("Votacao ainda ativa");
    });
  });

  describe("execute — proposta inexistente", function () {
    it("execute em proposta inexistente reverte", async function () {
      await expect(governance.execute(99)).to.be.revertedWith("Proposta inexistente");
    });
  });

  describe("execute — quórum não atingido", function () {
    it("rejeita proposta quando ninguém vota (quórum zerado)", async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Sem quórum");
      await time.increase(10 * 60 + 1); // VOTING_PERIOD = 10 minutos

      const auditorBefore = await ledger.getAuditor();
      await expect(governance.execute(1)).to.emit(governance, "ProposalRejected").withArgs(1);
      expect(await ledger.getAuditor()).to.equal(auditorBefore);

      const p = await governance.getProposal(1);
      expect(p.status).to.equal(2); // Rejected
    });
  });

  describe("vote — proposta já encerrada", function () {
    it("não pode votar em proposta já executada", async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "Proposta");
      await governance.connect(voter1).vote(1, true);
      await governance.connect(voter2).vote(1, true);
      await time.increase(10 * 60 + 1);
      await governance.execute(1); // executa → status Executed

      await expect(governance.connect(voter2).vote(1, false))
        .to.be.revertedWith("Votacao ja encerrada");
    });
  });

  describe("getAllProposals", function () {
    it("retorna todas as propostas criadas", async function () {
      await governance.connect(voter1).propose(auditorCandidate.address, "P1");
      await governance.connect(voter2).propose(stranger.address, "P2");

      const props = await governance.getAllProposals();
      expect(props.length).to.equal(2);
      expect(props[0].description).to.equal("P1");
      expect(props[1].description).to.equal("P2");
    });
  });

  describe("setAuditorByGovernance (GreenTrace)", function () {
    it("apenas governança pode chamar setAuditorByGovernance", async function () {
      await expect(ledger.connect(owner).setAuditorByGovernance(auditorCandidate.address))
        .to.be.revertedWith("Apenas a governanca");
    });
  });
});

