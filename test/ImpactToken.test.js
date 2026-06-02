const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ImpactToken", function () {
  let token;
  let owner;
  let minter;
  let user;

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();
    token = await ethers.deployContract("ImpactToken");
    await token.waitForDeployment();
  });

  it("nome e símbolo corretos", async function () {
    expect(await token.name()).to.equal("ImpactToken");
    expect(await token.symbol()).to.equal("IMPACT");
    expect(await token.decimals()).to.equal(18n);
  });

  it("supply inicial é zero", async function () {
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("owner pode mintar tokens", async function () {
    await token.mint(user.address, 1000n, "teste");
    const decimals = 10n ** 18n;
    expect(await token.balanceOf(user.address)).to.equal(1000n * decimals);
    expect(await token.totalSupply()).to.equal(1000n * decimals);
  });

  it("mint emite evento TokensMinted", async function () {
    const decimals = 10n ** 18n;
    await expect(token.mint(user.address, 500n, "bonus"))
      .to.emit(token, "TokensMinted")
      .withArgs(user.address, 500n * decimals, "bonus");
  });

  it("não-owner não pode mintar", async function () {
    await expect(token.connect(minter).mint(user.address, 100n, "fraude"))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });

  it("transferência de tokens funciona normalmente", async function () {
    const decimals = 10n ** 18n;
    await token.mint(user.address, 100n, "alocacao");
    await token.connect(user).transfer(minter.address, 30n * decimals);
    expect(await token.balanceOf(user.address)).to.equal(70n * decimals);
    expect(await token.balanceOf(minter.address)).to.equal(30n * decimals);
  });

  it("transferOwnership permite novo owner mintar", async function () {
    await token.transferOwnership(minter.address);
    await token.connect(minter).mint(user.address, 10n, "novo owner");
    expect(await token.balanceOf(user.address)).to.be.gt(0n);
  });

  it("owner antigo não pode mais mintar após transferência", async function () {
    await token.transferOwnership(minter.address);
    await expect(token.mint(user.address, 10n, "deve falhar"))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});
