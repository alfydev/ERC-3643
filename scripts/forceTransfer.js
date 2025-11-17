// scripts/forceTransfer.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();

  // ===== CONFIG =====
  const TOKEN_ADDRESS = "0x..."; // SWGTX proxy
  const FROM          = "0x..."; // take from here
  const TO            = "0x..."; // send back here
  const DECIMALS      = 18;
  const AMOUNT_HUMAN  = "5"; // force-transfer exactly 5 tokens
  // ===================

  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);

  console.log("👤 Agent signer:", agent.address);
  console.log("💊 Token       :", TOKEN_ADDRESS);
  console.log("↩️  From        :", FROM);
  console.log("➡️  To          :", TO);
  console.log("🔢 Amount      :", AMOUNT_HUMAN, `(=${amount.toString()} base units)`);

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);

  // Introspect functions
  const fns = Object.keys(token.functions || {});
  const has = (sig) => fns.includes(sig) || fns.some(s => s.startsWith(sig));

  // Paused?
  let paused = false;
  try { paused = await token.paused(); } catch {}
  console.log("⏸️  paused:", paused);

  // Identity checks (useful for logs; forcedTransfer may bypass checks depending on build)
  try {
    const irAddr = await token.identityRegistry();
    const ir = await ethers.getContractAt("IdentityRegistry", irAddr, agent);
    const vFrom = await ir.isVerified(FROM);
    const vTo   = await ir.isVerified(TO);
    console.log("🏛 IdentityRegistry:", irAddr);
    console.log("🔎 isVerified(from):", vFrom);
    console.log("🔎 isVerified(to)  :", vTo);
  } catch {
    console.log("ℹ️ Skipping IR checks (no interface accessible).");
  }

  // Confirm agent role if available
  if (has("isAgent(")) {
    try {
      const isAgent = await token.isAgent(agent.address);
      console.log("🛡️  isAgent(signer):", isAgent);
      if (!isAgent) {
        console.error("❌ Signer is not a token agent; cannot force-transfer.");
        process.exit(1);
      }
    } catch {}
  } else {
    console.log("ℹ️ Token does not expose isAgent(); continuing.");
  }

  // Balances before
  const balFromBefore = await token.balanceOf(FROM);
  const balToBefore   = await token.balanceOf(TO);
  console.log("💰 balance(FROM) before:", balFromBefore.toString());
  console.log("💰 balance(TO)   before:", balToBefore.toString());

  if (balFromBefore.lt(amount)) {
    console.warn("⚠️ FROM balance is less than amount; forceTransfer may revert depending on build.");
  }

  // Pick force-transfer method
  let call = null;
  if (has("forcedTransfer(address,address,uint256)")) {
    call = {
      name: "forcedTransfer(address,address,uint256)",
      static: (from, to, amt) => token.callStatic["forcedTransfer(address,address,uint256)"](from, to, amt),
      send:   (from, to, amt) => token["forcedTransfer(address,address,uint256)"](from, to, amt),
    };
  } else if (has("forceTransfer(address,address,uint256)")) {
    call = {
      name: "forceTransfer(address,address,uint256)",
      static: (from, to, amt) => token.callStatic["forceTransfer(address,address,uint256)"](from, to, amt),
      send:   (from, to, amt) => token["forceTransfer(address,address,uint256)"](from, to, amt),
    };
  } else {
    console.error("❌ No compatible forced transfer function found.");
    console.error("   Checked for: forcedTransfer(address,address,uint256), forceTransfer(address,address,uint256)");
    console.error("   Available:", fns);
    process.exit(1);
  }

  console.log(`🧨 Using method: ${call.name}`);

  // Preflight simulation
  try {
    await call.static(FROM, TO, amount);
    console.log("✅ callStatic forced transfer OK – sending tx…");
  } catch (err) {
    console.error("❌ callStatic forced transfer reverted.");
    console.error("   reason:", err.reason || err.message || err);
    process.exit(1);
  }

  // Send tx
  try {
    const tx = await call.send(FROM, TO, amount);
    console.log("⏳ force-transfer tx:", tx.hash);
    const rc = await tx.wait(2);
    console.log("✅ mined in block:", rc.blockNumber);
  } catch (err) {
    console.error("❌ force-transfer tx failed.");
    console.error("   reason:", err.reason || err.message || err);
    process.exit(1);
  }

  // Balances after
  const balFromAfter = await token.balanceOf(FROM);
  const balToAfter   = await token.balanceOf(TO);
  console.log("💰 balance(FROM) after :", balFromAfter.toString());
  console.log("💰 balance(TO)   after :", balToAfter.toString());
  console.log(`🎉 Force-transferred ${AMOUNT_HUMAN} tokens from ${FROM} → ${TO}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

