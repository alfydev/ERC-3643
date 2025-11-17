const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying from account:", deployer.address);

  // ----------------------------
  // 1️⃣ Deploy all base implementations
  // ----------------------------
  console.log("\n🧱 Deploying T-REX base implementations...");

  const Token = await ethers.getContractFactory("Token");
  const tokenImpl = await Token.deploy();
  await tokenImpl.deployed();
  console.log("✅ Token:", tokenImpl.address);

  const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
  const ctrImpl = await ClaimTopicsRegistry.deploy();
  await ctrImpl.deployed();
  console.log("✅ ClaimTopicsRegistry:", ctrImpl.address);

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const irImpl = await IdentityRegistry.deploy();
  await irImpl.deployed();
  console.log("✅ IdentityRegistry:", irImpl.address);

  const IdentityRegistryStorage = await ethers.getContractFactory("IdentityRegistryStorage");
  const irsImpl = await IdentityRegistryStorage.deploy();
  await irsImpl.deployed();
  console.log("✅ IdentityRegistryStorage:", irsImpl.address);

  const TrustedIssuersRegistry = await ethers.getContractFactory("TrustedIssuersRegistry");
  const tirImpl = await TrustedIssuersRegistry.deploy();
  await tirImpl.deployed();
  console.log("✅ TrustedIssuersRegistry:", tirImpl.address);

  const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
  const mcImpl = await ModularCompliance.deploy();
  await mcImpl.deployed();
  console.log("✅ ModularCompliance:", mcImpl.address);

  // ----------------------------
  // 2️⃣ Deploy TREXImplementationAuthority (as REFERENCE)
  // ----------------------------
  console.log("\n🏛️ Deploying TREXImplementationAuthority (as reference)...");
  const ImplementationAuthority = await ethers.getContractFactory("TREXImplementationAuthority");
  const implementationAuthority = await ImplementationAuthority.deploy(
    true,  // ✅ referenceStatus
    ethers.constants.AddressZero,
    ethers.constants.AddressZero
  );
  await implementationAuthority.deployed();
  console.log("✅ ImplementationAuthority:", implementationAuthority.address);

  // ----------------------------
  // 3️⃣ Register implementations (version 4.0.0)
  // ----------------------------
  console.log("\n📦 Registering T-REX implementations in the authority...");
  const version = { major: 4, minor: 0, patch: 0 };
  const trexContracts = {
    tokenImplementation: tokenImpl.address,
    ctrImplementation: ctrImpl.address,
    irImplementation: irImpl.address,
    irsImplementation: irsImpl.address,
    tirImplementation: tirImpl.address,
    mcImplementation: mcImpl.address,
  };

  const txAdd = await implementationAuthority.addAndUseTREXVersion(version, trexContracts);
  await txAdd.wait();
  console.log("✅ Implementations registered successfully");

  // ----------------------------
  // 4️⃣ Deploy ONCHAINID IdFactory
  // ----------------------------
  console.log("\n🆔 Deploying OnchainID IdFactory...");
  const IdFactory = await ethers.getContractFactory("IdFactory");
  const idFactory = await IdFactory.deploy(deployer.address);
  await idFactory.deployed();
  console.log("✅ OnchainID IdFactory:", idFactory.address);

  // ----------------------------
  // 5️⃣ Deploy TREXFactory (with real IdFactory)
  // ----------------------------
  console.log("\n🏗️ Deploying TREXFactory...");
  const TREXFactory = await ethers.getContractFactory("TREXFactory");
  const trexFactory = await TREXFactory.deploy(
    implementationAuthority.address,
    idFactory.address
  );
  await trexFactory.deployed();
  console.log("✅ TREXFactory:", trexFactory.address);

  // ----------------------------
  // 6️⃣ Deploy IAFactory
  // ----------------------------
  console.log("\n🏭 Deploying IAFactory...");
  const IAFactory = await ethers.getContractFactory("IAFactory");
  const iaFactory = await IAFactory.deploy(trexFactory.address);
  await iaFactory.deployed();
  console.log("✅ IAFactory:", iaFactory.address);

  // ----------------------------
  // 7️⃣ Link factories inside ImplementationAuthority
  // ----------------------------
  // console.log("\n🔗 Linking IAFactory & TREXFactory inside ImplementationAuthority...");
  // const tx1 = await implementationAuthority.setIAFactory(iaFactory.address);
  // await tx1.wait();
  // const tx2 = await implementationAuthority.setTREXFactory(trexFactory.address);
  // await tx2.wait();
  console.log("🔗 Skipping linking (reference authority cannot link itself)");
  // console.log("✅ Linking complete");

  // addendum add TREXGateway...
  console.log("🏗️ Deploying TREXGateway and linking ownership...");
  const Gateway = await ethers.getContractFactory("TREXGateway");

  // pass TREXFactory address + enable publicDeployment
  const gateway = await Gateway.deploy(trexFactory.address, true);
  await gateway.deployed();

  console.log(`✅ TREXGateway deployed at: ${gateway.address}`);

  // make the gateway the factory owner
  const tx = await trexFactory.transferOwnership(gateway.address);
  await tx.wait();
  console.log(`🔗 Linked TREXFactory ownership to gateway (${gateway.address})`);


  // ----------------------------
  // ✅ Summary
  // ----------------------------
  console.log("\n🎉 All deployments successful!");
  console.log("ImplementationAuthority:", implementationAuthority.address);
  console.log("OnchainID IdFactory:", idFactory.address);
  console.log("TREXFactory:", trexFactory.address);
  console.log("IAFactory:", iaFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


