// scripts/01_deployInvestorIdentity.js
const { ethers } = require("hardhat");
const OnchainID = require("@onchain-id/solidity"); // <-- uses the package's ABIs/bytecode

async function main() {
  const [deployer] = await ethers.getSigners();

  // Your investor wallet (destination for mint)
  const INVESTOR_WALLET = "0x...";

  console.log("🆔 Deploying ONCHAINID Identity for investor wallet...");
  console.log("👤 Signer:", deployer.address);
  console.log("👛 Investor:", INVESTOR_WALLET);

  // OnchainID Identity constructor in this repo’s tests:
  // new Identity(initialManagementKey, bool addInitialKeys)
  // They call: deploy(deployer.address, true)
  // We'll set the investor wallet as the management key so the wallet controls the identity.
  const IdentityFactory = new ethers.ContractFactory(
    OnchainID.contracts.Identity.abi,
    OnchainID.contracts.Identity.bytecode,
    deployer
  );

  // Static call to catch constructor issues early
  try {
    await ethers.provider.estimateGas({
      data: IdentityFactory.getDeployTransaction(INVESTOR_WALLET, true).data,
    });
    console.log("✅ Constructor pre-check OK.");
  } catch (err) {
    console.error("❌ Identity constructor pre-check failed:", err.reason || err.message || err);
    process.exit(1);
  }

  // Deploy
  try {
    const identity = await IdentityFactory.deploy(INVESTOR_WALLET, true);
    console.log("⏳ Identity deployment tx:", identity.deployTransaction.hash);
    const receipt = await identity.deployTransaction.wait(2);
    console.log("✅ Identity deployed in block:", receipt.blockNumber);
    console.log("🎯 Investor Identity address:", identity.address);
    console.log("   (Save this address; you’ll register it in script 02)");
  } catch (err) {
    console.error("❌ Failed to deploy Identity:", err.reason || err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});

