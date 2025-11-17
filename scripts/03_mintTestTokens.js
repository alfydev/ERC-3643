// scripts/03_mintTestTokens.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const TOKEN_ADDRESS = "0x...";
  const INVESTOR_WALLET = "0x...";
  const DECIMALS = 18;
  const AMOUNT_HUMAN = "1000";

  console.log("💸 Mint e2e test");
  console.log("👤 Signer (must be token AGENT):", deployer.address);
  console.log("💊 Token:", TOKEN_ADDRESS);
  console.log("👛 Dest :", INVESTOR_WALLET);

  // Attach
  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, deployer);
  const irAddr = await token.identityRegistry();
  const ir = await ethers.getContractAt("IdentityRegistry", irAddr, deployer);
  console.log("🏛 IdentityRegistry:", irAddr);

  // Check verified
  const verified = await ir.isVerified(INVESTOR_WALLET);
  console.log("🔎 isVerified(dest):", verified);
  if (!verified) {
    console.error("❌ Destination wallet is NOT verified — mint will revert.");
    process.exit(1);
  }

  // Balances
  const before = await token.balanceOf(INVESTOR_WALLET);
  console.log("💰 Balance before:", before.toString());

  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);

  // callStatic
  try {
    await token.callStatic.mint(INVESTOR_WALLET, amount);
    console.log("✅ callStatic.mint OK – sending tx.");
  } catch (err) {
    console.error("❌ callStatic.mint reverted:", err.reason || err.message || err);
    process.exit(1);
  }

  // mint
  const tx = await token.mint(INVESTOR_WALLET, amount);
  console.log("⏳ mint tx:", tx.hash);
  await tx.wait(2);

  const after = await token.balanceOf(INVESTOR_WALLET);
  console.log("✅ Minted. Balance after:", after.toString());
  console.log(`🎉 Successfully minted ${AMOUNT_HUMAN} tokens to ${INVESTOR_WALLET}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});

