// scripts/pauseToken.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();

  // === CONFIG ===
  const TOKEN_ADDRESS = "0x..."; // SWGTX proxy
  // ==============

  console.log("👤 Signer (agent):", agent.address);
  console.log("💊 Token address :", TOKEN_ADDRESS);

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);

  const fns = Object.keys(token.functions || {});
  const has = (sig) => fns.includes(sig) || fns.some(s => s.startsWith(sig));

  // Ensure pause() exists
  if (!has("pause()")) {
    console.error("❌ This token does not expose pause().");
    console.error("   Available functions:", fns);
    process.exit(1);
  }

  // Optional: check agent role if the function exists
  if (has("isAgent(")) {
    try {
      const isAgent = await token.isAgent(agent.address);
      console.log("🛡️  isAgent(signer):", isAgent);
      if (!isAgent) {
        console.error("❌ Signer is not a token agent; cannot call pause().");
        process.exit(1);
      }
    } catch {
      // ignore
    }
  }

  // Show current paused state
  try {
    const before = await token.paused();
    console.log("⏸️  paused before:", before);
    if (before) {
      console.log("ℹ️ Token already paused. Nothing to do.");
      return;
    }
  } catch {
    console.log("ℹ️ Could not read paused() state (continuing).");
  }

  // Preflight simulation
  try {
    await token.callStatic.pause();
    console.log("✅ callStatic.pause OK – sending tx…");
  } catch (err) {
    console.error("❌ callStatic.pause reverted:", err.reason || err.message || err);
    process.exit(1);
  }

  // Send tx
  try {
    const tx = await token.pause();
    console.log("⏳ pause tx:", tx.hash);
    const rc = await tx.wait(2);
    console.log("✅ pause() mined in block:", rc.blockNumber);
  } catch (err) {
    console.error("❌ pause() tx failed:", err.reason || err.message || err);
    process.exit(1);
  }

  // Verify after
  try {
    const after = await token.paused();
    console.log("⏸️  paused after :", after);
  } catch {
    // ignore
  }

  console.log("🎉 Token is now paused.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

