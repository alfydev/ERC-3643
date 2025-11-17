// scripts/02_registerIdentity.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // === UPDATE THIS: paste the Identity address printed by script 01 ===
  const INVESTOR_IDENTITY = "0x..."; // paste the Identity address here

  // Your previously deployed token:
  const TOKEN_ADDRESS = "0x...";
  const INVESTOR_WALLET = "0x...";

  // Any uint16 country (ISO-3166 numeric). 756 = Switzerland, for example.
  const INVESTOR_COUNTRY = 756;

  console.log("🧾 Registering investor in this token’s IdentityRegistry...");
  console.log("👤 Signer (must be IR agent):", deployer.address);
  console.log("💊 Token:", TOKEN_ADDRESS);
  console.log("🆔 Identity:", INVESTOR_IDENTITY);
  console.log("👛 Wallet:", INVESTOR_WALLET);

  // Attach to Token
  let token;
  try {
    token = await ethers.getContractAt("Token", TOKEN_ADDRESS, deployer);
  } catch (err) {
    console.error("❌ Could not attach to Token:", err);
    process.exit(1);
  }

  // Fetch IdentityRegistry
  let irAddress, ir;
  try {
    irAddress = await token.identityRegistry();
    ir = await ethers.getContractAt("IdentityRegistry", irAddress, deployer);
  } catch (err) {
    console.error("❌ Could not attach to IdentityRegistry:", err);
    process.exit(1);
  }
  console.log("🏛 IdentityRegistry:", irAddress);

  // Check current state
  try {
    const currentId = await ir.identity(INVESTOR_WALLET);
    const verified = await ir.isVerified(INVESTOR_WALLET);
    console.log("🔎 Before: identity=", currentId, " verified=", verified);
  } catch (err) {
    console.error("❌ Failed to query IR before:", err);
    process.exit(1);
  }

  // callStatic first
  try {
    await ir.callStatic.registerIdentity(INVESTOR_WALLET, INVESTOR_IDENTITY, INVESTOR_COUNTRY);
    console.log("✅ callStatic.registerIdentity OK – sending tx.");
  } catch (err) {
    console.error("❌ registerIdentity callStatic reverted:", err.reason || err.message || err);
    console.error("   HINTS:");
    console.error("   • Ensure the signer is an IdentityRegistry AGENT (we added deployer in TokenDetails.irAgents).");
    console.error("   • Ensure INVESTOR_IDENTITY is a valid deployed Identity contract.");
    process.exit(1);
  }

  // real tx
  try {
    const tx = await ir.registerIdentity(INVESTOR_WALLET, INVESTOR_IDENTITY, INVESTOR_COUNTRY);
    console.log("⏳ registerIdentity tx:", tx.hash);
    const receipt = await tx.wait(2);
    console.log("✅ registerIdentity mined in block:", receipt.blockNumber);
  } catch (err) {
    console.error("❌ registerIdentity tx failed:", err.reason || err.message || err);
    process.exit(1);
  }

  // Check after
  try {
    const currentId = await ir.identity(INVESTOR_WALLET);
    const verified = await ir.isVerified(INVESTOR_WALLET);
    console.log("🔎 After:  identity=", currentId, " verified=", verified);
    if (!verified) {
      console.warn("⚠️ Still not verified. If ClaimTopicsRegistry has topics configured, you’ll need proper claims. If CTR has NO topics, non-zero identity is enough.");
    } else {
      console.log("🎉 Investor is VERIFIED for this token.");
    }
  } catch (err) {
    console.error("❌ Failed to query IR after:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});

