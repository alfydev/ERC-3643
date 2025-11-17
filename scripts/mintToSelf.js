// scripts/mintToSelf.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();

  // === CONFIG ===
  const TOKEN_ADDRESS = "0x...";  // SWGTX proxy
  const RECIPIENT     = "0x..."; // your wallet
  const DECIMALS      = 18;
  const AMOUNT_HUMAN  = "1000"; // mint 1000 tokens
  // ==============

  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);

  console.log("👤 Agent signer:", agent.address);
  console.log("💊 Token       :", TOKEN_ADDRESS);
  console.log("🎯 Recipient   :", RECIPIENT);
  console.log("🔢 Amount      :", AMOUNT_HUMAN, `(=${amount.toString()} base units)`);

  // Attach to token
  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);

  // Introspect available functions
  const fns = Object.keys(token.functions || {});
  const has = (sigStart) => fns.some(s => s.startsWith(sigStart));

  // Ensure mint(address,uint256) exists
  if (!has("mint(")) {
    console.error("❌ Token does not expose mint(address,uint256).");
    console.error("   Available functions:", fns);
    process.exit(1);
  }

  // Optional: paused?
  try {
    const paused = await token.paused();
    console.log("⏸️  paused:", paused);
    if (paused) {
      console.error("❌ Token is paused; unpause before minting.");
      process.exit(1);
    }
  } catch {
    console.log("ℹ️ Could not read paused() (continuing).");
  }

  // Optional: check agent role if exposed
  if (has("isAgent(")) {
    try {
      const isAgent = await token.isAgent(agent.address);
      console.log("🛡️  isAgent(signer):", isAgent);
      if (!isAgent) {
        console.error("❌ Signer is not a token agent; cannot mint.");
        process.exit(1);
      }
    } catch {/* ignore */}
  }

  // Verify recipient in IR (T-REX requires isVerified(to))
  try {
    const irAddr = await token.identityRegistry();
    const ir = await ethers.getContractAt("IdentityRegistry", irAddr, agent);
    const verified = await ir.isVerified(RECIPIENT);
    console.log("🏛 IdentityRegistry:", irAddr);
    console.log("🔎 isVerified(recipient):", verified);
    if (!verified) {
      console.error("❌ Recipient is not verified in IdentityRegistry; mint would revert.");
      process.exit(1);
    }
  } catch {
    console.log("ℹ️ Skipping IdentityRegistry checks (continuing).");
  }

  // Balances before
  const before = await token.balanceOf(RECIPIENT);
  const supplyBefore = await token.totalSupply();
  console.log("💰 balance(recipient) before:", before.toString());
  console.log("🧮 totalSupply before       :", supplyBefore.toString());

  // Preflight simulation
  try {
    await token.callStatic.mint(RECIPIENT, amount);
    console.log("✅ callStatic.mint OK – sending tx…");
  } catch (err) {
    console.error("❌ callStatic.mint reverted:", err.reason || err.message || err);
    process.exit(1);
  }

  // Send tx
  try {
    const tx = await token.mint(RECIPIENT, amount);
    console.log("⏳ mint tx:", tx.hash);
    const rc = await tx.wait(2);
    console.log("✅ mint() mined in block:", rc.blockNumber);
  } catch (err) {
    console.error("❌ mint tx failed:", err.reason || err.message || err);
    process.exit(1);
  }

  // After
  const after = await token.balanceOf(RECIPIENT);
  const supplyAfter = await token.totalSupply();
  console.log("💰 balance(recipient) after :", after.toString());
  console.log("🧮 totalSupply after        :", supplyAfter.toString());
  console.log(`🎉 Minted ${AMOUNT_HUMAN} tokens to ${RECIPIENT}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

