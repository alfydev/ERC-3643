const { ethers } = require("hardhat");
const OnchainID = require("@onchain-id/solidity");

async function main() {
  const [signer] = await ethers.getSigners();

  // === CONFIG ===
  const TOKEN_ADDRESS     = "0x..."; // your token address
  const RECIPIENT_WALLET  = "0x..."; // wallet to authorize
  const COUNTRY_CODE      = 756; // any uint16; 756=CH (works since CTR has no topics)
  const DECIMALS          = 18;
  const AMOUNT_HUMAN      = "25"; // how many SWGTX to send now (change as you like)

  console.log("👤 Signer:", signer.address);
  console.log("💊 Token :", TOKEN_ADDRESS);
  console.log("👛 To    :", RECIPIENT_WALLET);

  // 1) Attach to token & IR
  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, signer);
  const irAddr = await token.identityRegistry();
  const ir = await ethers.getContractAt("IdentityRegistry", irAddr, signer);
  console.log("🏛 IdentityRegistry:", irAddr);

  // 2) If recipient has no Identity yet, deploy one
  let currentId = await ir.identity(RECIPIENT_WALLET);
  if (currentId === ethers.constants.AddressZero) {
    console.log("🆔 No identity on IR for recipient. Deploying an Identity...");
    const IdentityFactory = new ethers.ContractFactory(
      OnchainID.contracts.Identity.abi,
      OnchainID.contracts.Identity.bytecode,
      signer
    );

    // Use recipient wallet as the management key so they control their identity.
    const identity = await IdentityFactory.deploy(RECIPIENT_WALLET, true);
    console.log("⏳ Identity deploy tx:", identity.deployTransaction.hash);
    await identity.deployTransaction.wait(2);
    currentId = identity.address;
    console.log("✅ Deployed Identity for recipient:", currentId);
  } else {
    console.log("ℹ️ Recipient already mapped to Identity in IR:", currentId);
  }

  // 3) If identity isn’t registered yet, register it
  const beforeVerified = await ir.isVerified(RECIPIENT_WALLET);
  if (!beforeVerified) {
    console.log("🧾 Registering recipient identity in IR...");
    // callStatic sanity check
    await ir.callStatic.registerIdentity(RECIPIENT_WALLET, currentId, COUNTRY_CODE);
    const tx = await ir.registerIdentity(RECIPIENT_WALLET, currentId, COUNTRY_CODE);
    console.log("⏳ registerIdentity tx:", tx.hash);
    await tx.wait(2);
    console.log("✅ Recipient registered in IR.");
  } else {
    console.log("ℹ️ Recipient already verified in IR.");
  }

  // 4) Confirm verification now
  const afterVerified = await ir.isVerified(RECIPIENT_WALLET);
  console.log("🔎 isVerified(recipient):", afterVerified);
  if (!afterVerified) {
    throw new Error("Recipient still not verified (check IR agent role and CTR topics/issuers).");
  }

  // 5) Transfer tokens
  const amount = ethers.utils.parseUnits(AMOUNT_HUMAN, DECIMALS);
  console.log(`💸 Transferring ${AMOUNT_HUMAN} tokens to ${RECIPIENT_WALLET}...`);

  // Optional: callStatic to pre-check compliance
  await token.callStatic.transfer(RECIPIENT_WALLET, amount);

  const tx2 = await token.transfer(RECIPIENT_WALLET, amount);
  console.log("⏳ transfer tx:", tx2.hash);
  await tx2.wait(2);
  console.log("✅ Transfer complete.");
}

main().catch((err) => {
  console.error("❌ Script failed:", err.reason || err.message || err);
  process.exit(1);
});

