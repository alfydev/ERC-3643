const { ethers } = require("hardhat");

async function main() {
  const [sender] = await ethers.getSigners();

  const TOKEN = "0x...";
  const FROM  = "0x...";
  const TO    = "0x...";
  const DECIMALS = 18;
  const AMOUNT   = ethers.utils.parseUnits("10", DECIMALS);

  const token = await ethers.getContractAt("Token", TOKEN, sender);

  console.log("token:", TOKEN);
  console.log("from :", FROM);
  console.log("to   :", TO);

  // Basic checks
  const paused = await token.paused().catch(() => null);
  if (paused !== null) console.log("paused:", paused);

  const irAddr = await token.identityRegistry();
  const ir = await ethers.getContractAt("IdentityRegistry", irAddr, sender);
  const vFrom = await ir.isVerified(FROM);
  const vTo   = await ir.isVerified(TO);
  console.log("isVerified(from):", vFrom);
  console.log("isVerified(to)  :", vTo);

  // Try to detect compliance contract and run canTransfer if available
  let complianceAddr;
  try {
    // T-REX Token exposes either 'compliance()' or 'getCompliance()' depending on version
    if (Object.keys(token.functions).some(f => f.startsWith("compliance("))) {
      complianceAddr = await token.compliance();
    } else if (Object.keys(token.functions).some(f => f.startsWith("getCompliance("))) {
      complianceAddr = await token.getCompliance();
    }
  } catch (_) {}
  if (complianceAddr) {
    console.log("compliance:", complianceAddr);
    try {
      const comp = await ethers.getContractAt("ModularCompliance", complianceAddr, sender);
      if (Object.keys(comp.functions).some(f => f.startsWith("canTransfer("))) {
        const ok = await comp.canTransfer(FROM, TO, AMOUNT);
        console.log("canTransfer (from compliance):", ok);
      }
      if (Object.keys(comp.functions).some(f => f.startsWith("getModules("))) {
        const mods = await comp.getModules();
        console.log("modules:", mods);
      }
    } catch (e) {
      console.log("could not query compliance details:", e.message || e);
    }
  }

  // Check for freeze flags if the functions exist
  const tokenFns = Object.keys(token.functions);
  if (tokenFns.some(f => f.startsWith("isFrozen("))) {
    try { console.log("token.isFrozen(from):", await token.isFrozen(FROM)); } catch {}
    try { console.log("token.isFrozen(to)  :", await token.isFrozen(TO)); } catch {}
  }
  const irFns = Object.keys(ir.functions);
  if (irFns.some(f => f.startsWith("isFrozen("))) {
    try { console.log("ir.isFrozen(from):", await ir.isFrozen(FROM)); } catch {}
    try { console.log("ir.isFrozen(to)  :", await ir.isFrozen(TO)); } catch {}
  }

  // The exact simulation MetaMask does (roughly)
  console.log("trying callStatic.transfer...");
  try {
    await token.callStatic.transfer(TO, AMOUNT, { from: FROM });
    console.log("✅ callStatic.transfer would succeed.");
  } catch (err) {
    console.error("❌ callStatic.transfer would revert.");
    console.error("   reason:", err.reason || err.message || err);
  }

  // Double-check balances
  const balFrom = await token.balanceOf(FROM);
  const balTo   = await token.balanceOf(TO);
  console.log("balance(from):", balFrom.toString());
  console.log("balance(to)  :", balTo.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });

