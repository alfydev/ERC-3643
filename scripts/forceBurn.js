// scripts/forceBurn.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();

  // ====== CONFIG ======
  const TOKEN_ADDRESS = "0x...";         // SWGTX proxy
  const TARGET       = "0x...";        // address to burn from
  const DECIMALS     = 18;                                                  // your token uses 18
  const AMOUNT_HUMAN = "5";                                                // amount to burn (human units)
  // =====================

  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);

  console.log("👤 Agent signer:", agent.address);
  console.log("💊 Token       :", TOKEN_ADDRESS);
  console.log("🎯 Burn target :", TARGET);
  console.log("🔢 Amount      :", AMOUNT_HUMAN, `(=${amount.toString()} base units)`);

  // Attach token
  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);

  // Introspect available functions
  const fns = Object.keys(token.functions || {});
  const has = (sigStart) => fns.some((s) => s.startsWith(sigStart));

  // Optional checks
  let paused = false;
  try { paused = await token.paused(); } catch {}
  console.log("⏸️  paused:", paused);

  // Identity/verification
  let irAddr, ir;
  try {
    irAddr = await token.identityRegistry();
    ir = await ethers.getContractAt("IdentityRegistry", irAddr, agent);
    const vFrom = await ir.isVerified(agent.address);
    const vTo   = await ir.isVerified(TARGET);
    console.log("🏛 IdentityRegistry:", irAddr);
    console.log("🔎 isVerified(agent):", vFrom);
    console.log("🔎 isVerified(target):", vTo);
  } catch {
    console.log("ℹ️ Skipping identity checks (no IR interface available).");
  }

  // Optional: check agent role if method exists
  if (has("isAgent(")) {
    try {
      const isAgent = await token.isAgent(agent.address);
      console.log("🛡️  isAgent(signer):", isAgent);
      if (!isAgent) {
        console.error("❌ Signer is not a token agent. Use an agent to perform force burn.");
        process.exit(1);
      }
    } catch {}
  } else {
    console.log("ℹ️ Token does not expose isAgent(); continuing.");
  }

  // Balances & supply before
  const balBefore = await token.balanceOf(TARGET);
  const supplyBefore = await token.totalSupply();
  console.log("💰 balance(target) before :", balBefore.toString());
  console.log("🧮 totalSupply before     :", supplyBefore.toString());

  if (balBefore.lt(amount)) {
    console.warn("⚠️ Target balance is less than burn amount; burn will likely revert.");
  }

  // Choose the burn function (in priority order)
  let burnCall;
  if (has("forcedBurn(address,uint256)")) {
    burnCall = {
      name: "forcedBurn(address,uint256)",
      fn: (to, amt) => token["forcedBurn(address,uint256)"](to, amt),
      static: (to, amt) => token.callStatic["forcedBurn(address,uint256)"](to, amt),
    };
  } else if (has("forceBurn(address,uint256)")) {
    burnCall = {
      name: "forceBurn(address,uint256)",
      fn: (to, amt) => token["forceBurn(address,uint256)"](to, amt),
      static: (to, amt) => token.callStatic["forceBurn(address,uint256)"](to, amt),
    };
  } else if (has("burn(address,uint256)")) {
    // Many T-REX builds expose agent burn as burn(address,uint256)
    burnCall = {
      name: "burn(address,uint256)",
      fn: (to, amt) => token["burn(address,uint256)"](to, amt),
      static: (to, amt) => token.callStatic["burn(address,uint256)"](to, amt),
    };
  } else {
    console.error("❌ No compatible force-burn function found on this token.");
    console.error("   Checked for: forcedBurn(address,uint256), forceBurn(address,uint256), burn(address,uint256)");
    console.error("   Available:", fns);
    process.exit(1);
  }

  console.log(`🧨 Using burn method: ${burnCall.name}`);

  // Preflight (simulate)
  try {
    await burnCall.static(TARGET, amount);
    console.log("✅ callStatic burn succeeded – sending tx…");
  } catch (err) {
    console.error("❌ callStatic burn reverted.");
    console.error("   reason:", err.reason || err.message || err);
    process.exit(1);
  }

  // Send tx
  try {
    const tx = await burnCall.fn(TARGET, amount);
    console.log("⏳ burn tx:", tx.hash);
    const rec = await tx.wait(2);
    console.log("✅ burn mined in block:", rec.blockNumber);
  } catch (err) {
    console.error("❌ burn tx failed.");
    console.error("   reason:", err.reason || err.message || err);
    process.exit(1);
  }

  // After
  const balAfter = await token.balanceOf(TARGET);
  const supplyAfter = await token.totalSupply();
  console.log("💰 balance(target) after  :", balAfter.toString());
  console.log("🧮 totalSupply after      :", supplyAfter.toString());
  console.log(`🎉 Burned ${AMOUNT_HUMAN} tokens from ${TARGET}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

