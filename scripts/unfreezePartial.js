// scripts/unfreezePartial.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();

  // === CONFIG ===
  const TOKEN_ADDRESS = "0x..."; // SWGTX proxy
  const TARGET        = "0x..."; // address to unfreeze
  const DECIMALS      = 18;
  const AMOUNT_HUMAN  = "5"; // unfreeze exactly 5 tokens
  // ==============

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);
  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);

  const fns = Object.keys(token.functions || {});
  const has = (sigStart) => fns.some((s) => s.startsWith(sigStart));

  // pick a frozen-balance getter if available
  let frozenGetter = null;
  if (has("tokensFrozen(")) {
    frozenGetter = async (addr) => token.tokensFrozen(addr);
  } else if (has("frozenTokens(")) {
    frozenGetter = async (addr) => token.frozenTokens(addr);
  }

  // basic info
  let paused = false;
  try { paused = await token.paused(); } catch {}
  console.log("👤 Agent:", agent.address);
  console.log("💊 Token:", TOKEN_ADDRESS);
  console.log("🎯 Target:", TARGET);
  console.log("⏸️  paused:", paused);

  if (!has("unfreezePartialTokens(")) {
    console.error("❌ This token does not expose unfreezePartialTokens(address,uint256).");
    console.error("   Available functions:", fns);
    process.exit(1);
  }

  // check agent role if available
  if (has("isAgent(")) {
    const isAgent = await token.isAgent(agent.address);
    console.log("🛡️  isAgent(signer):", isAgent);
    if (!isAgent) {
      console.error("❌ Signer is not a token agent; cannot unfreeze.");
      process.exit(1);
    }
  }

  const balBefore = await token.balanceOf(TARGET);
  const frozenBefore = frozenGetter ? await frozenGetter(TARGET) : null;

  console.log("💰 balance(target) before:", balBefore.toString());
  if (frozenBefore !== null) console.log("🧊 frozen(target)  before:", frozenBefore.toString());

  // simulate
  try {
    await token.callStatic.unfreezePartialTokens(TARGET, amount);
    console.log("✅ callStatic.unfreezePartialTokens OK – sending tx…");
  } catch (err) {
    console.error("❌ callStatic.unfreezePartialTokens reverted:", err.reason || err.message || err);
    process.exit(1);
  }

  // send tx
  const tx = await token.unfreezePartialTokens(TARGET, amount);
  console.log("⏳ unfreezePartialTokens tx:", tx.hash);
  const rc = await tx.wait(2);
  console.log("✅ mined in block:", rc.blockNumber);

  const balAfter = await token.balanceOf(TARGET);
  const frozenAfter = frozenGetter ? await frozenGetter(TARGET) : null;

  console.log("💰 balance(target) after :", balAfter.toString());
  if (frozenAfter !== null) console.log("🧊 frozen(target)  after :", frozenAfter.toString());
  console.log(`🎉 Unfroze ${AMOUNT_HUMAN} tokens on ${TARGET}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

