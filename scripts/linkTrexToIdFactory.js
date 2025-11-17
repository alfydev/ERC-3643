const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // 🧩 Addresses from your factory deployment log
  const ID_FACTORY_ADDRESS = "0x...";
  const TREX_FACTORY_ADDRESS = "0x...";

  console.log("🔧 Linking TREXFactory to IdFactory on Sepolia...");
  console.log("👤 Deployer:", deployer.address);
  console.log("🏛 IdFactory:", ID_FACTORY_ADDRESS);
  console.log("🏭 TREXFactory:", TREX_FACTORY_ADDRESS);

  // IdFactory is a contract from the OnchainID dependency, but you already
  // deployed it here with:
  //   const IdFactory = await ethers.getContractFactory("IdFactory");
  // so the Hardhat artifact is available as "IdFactory".
  const idFactory = await ethers.getContractAt("IdFactory", ID_FACTORY_ADDRESS, deployer);

  const idFactoryFns = Object.keys(idFactory.functions || {});
  if (!idFactoryFns.some(fn => fn.startsWith("addTokenFactory("))) {
    console.error("❌ IdFactory does not expose addTokenFactory(address).");
    console.error("   Available functions:", idFactoryFns);
    process.exit(1);
  }

  console.log("➕ Calling idFactory.addTokenFactory(TREX_FACTORY_ADDRESS)...");
  const tx = await idFactory.addTokenFactory(TREX_FACTORY_ADDRESS);
  console.log("⏳ Tx submitted:", tx.hash);
  const receipt = await tx.wait(1);
  console.log("✅ addTokenFactory() mined in block", receipt.blockNumber);
}

main().catch((err) => {
  console.error("Fatal error in linkTrexToIdFactory:", err);
  process.exit(1);
});

