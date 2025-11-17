// scripts/authorizeRecipientOnly.js
const { ethers } = require("hardhat");
const OnchainID = require("@onchain-id/solidity");

async function main() {
  const [signer] = await ethers.getSigners();

  const TOKEN_ADDRESS    = "0x...";
  const RECIPIENT_WALLET = "0x...";
  const COUNTRY_CODE     = 756;

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, signer);
  const irAddr = await token.identityRegistry();
  const ir = await ethers.getContractAt("IdentityRegistry", irAddr, signer);

  let identity = await ir.identity(RECIPIENT_WALLET);
  if (identity === ethers.constants.AddressZero) {
    const IdentityFactory = new ethers.ContractFactory(
      OnchainID.contracts.Identity.abi,
      OnchainID.contracts.Identity.bytecode,
      signer
    );
    const id = await IdentityFactory.deploy(RECIPIENT_WALLET, true);
    await id.deployTransaction.wait(2);
    identity = id.address;
    console.log("✅ Deployed recipient Identity:", identity);
  } else {
    console.log("ℹ️ Recipient already mapped to Identity:", identity);
  }

  const verifiedBefore = await ir.isVerified(RECIPIENT_WALLET);
  if (!verifiedBefore) {
    await ir.callStatic.registerIdentity(RECIPIENT_WALLET, identity, COUNTRY_CODE);
    const tx = await ir.registerIdentity(RECIPIENT_WALLET, identity, COUNTRY_CODE);
    console.log("⏳ registerIdentity tx:", tx.hash);
    await tx.wait(2);
  }

  console.log("🎉 isVerified(recipient):", await ir.isVerified(RECIPIENT_WALLET));
}

main().catch((e)=>{console.error(e); process.exit(1);});

