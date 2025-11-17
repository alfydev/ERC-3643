const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting ERC-3643 (T-REX) Token Deployment via TREXGateway...\n");

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}\n`);

  //------------------------------------------------------------
  // 🔧 Configuration
  //------------------------------------------------------------
  const GATEWAY_ADDRESS = "0x..."; // TREXGateway on Sepolia

  const TOKEN_NAME = "SWGTREX";
  const TOKEN_SYMBOL = "SWGTX";
  const DECIMALS = 18;
  const INITIAL_SUPPLY = "1000"; // human-readable
  const ZERO = ethers.constants.AddressZero;

  //------------------------------------------------------------
  // 🏗️ Step 1. Attach to TREXGateway
  //------------------------------------------------------------
  let gateway;
  try {
    gateway = await ethers.getContractAt("TREXGateway", GATEWAY_ADDRESS, deployer);
    console.log(`🏦 Connected to TREXGateway at ${GATEWAY_ADDRESS}`);
  } catch (err) {
    console.error("❌ Failed to attach to TREXGateway:", err);
    process.exit(1);
  }

  //------------------------------------------------------------
  // 🧩 Step 2. Minimal sanity check on gateway functions
  //------------------------------------------------------------
  const gatewayFns = Object.keys(gateway.functions || {});
  if (!gatewayFns.some(fn => fn.startsWith("batchDeployTREXSuite("))) {
    console.error("❌ TREXGateway does not expose a batchDeployTREXSuite(...) function.");
    console.error("   Available functions:", gatewayFns);
    process.exit(1);
  }

  let publicDeploymentStatus = false;
  let isDeployer = false;
  let deploymentFee;
  let deploymentFeeEnabled = false;
  let factoryAddress;

  try {
    publicDeploymentStatus = await gateway.getPublicDeploymentStatus();
  } catch (err) {
    console.error("❌ Failed to call getPublicDeploymentStatus():", err);
    process.exit(1);
  }

  // isDeployer(address) may or may not exist in some builds; treat errors as "false"
  try {
    if (gatewayFns.some(fn => fn.startsWith("isDeployer("))) {
      isDeployer = await gateway.isDeployer(deployer.address);
    } else {
      isDeployer = false;
    }
  } catch {
    isDeployer = false;
  }

  try {
    deploymentFee = await gateway.getDeploymentFee();
    deploymentFeeEnabled = await gateway.isDeploymentFeeEnabled();
    factoryAddress = await gateway.getFactory();
  } catch (err) {
    console.error("❌ Failed to read gateway fee/factory state:", err);
    process.exit(1);
  }

  console.log("ℹ️ Public deployments enabled:", publicDeploymentStatus);
  console.log("ℹ️ Caller is registered deployer:", isDeployer);
  console.log("ℹ️ Deployment fee enabled:", deploymentFeeEnabled);
  console.log("ℹ️ Deployment fee struct:", deploymentFee);
  console.log("🏭 Factory from gateway.getFactory():", factoryAddress);

  if (!publicDeploymentStatus && !isDeployer) {
    console.error(
      "❌ This account is not allowed to deploy via Gateway.\n" +
      "   Either enable public deployments on TREXGateway or add this address as a deployer."
    );
    process.exit(1);
  }

  //------------------------------------------------------------
  // 🔍 Step 3. Attach TREXFactory & check IA wiring
  //------------------------------------------------------------
  let trexFactory;
  try {
    trexFactory = await ethers.getContractAt("TREXFactory", factoryAddress, deployer);
  } catch (err) {
    console.error("❌ Failed to attach to TREXFactory at gateway factory address:", err);
    process.exit(1);
  }

  let iaAddress, idFactoryAddress;
  try {
    iaAddress = await trexFactory.getImplementationAuthority();
    idFactoryAddress = await trexFactory.getIdFactory();
  } catch (err) {
    console.error("❌ Failed to read TREXFactory config (IA / IdFactory):", err);
    process.exit(1);
  }

  console.log("🏛 ImplementationAuthority (from factory):", iaAddress);
  console.log("🆔 IdFactory (from factory):", idFactoryAddress);

  if (iaAddress === ZERO) {
    console.error("❌ ImplementationAuthority address on TREXFactory is ZERO – deployment cannot proceed.");
    process.exit(1);
  }

  // Check IA has implementations wired
  try {
    const ia = await ethers.getContractAt("TREXImplementationAuthority", iaAddress, deployer);
    const tokenImpl = await ia.getTokenImplementation();
    const ctrImpl = await ia.getCTRImplementation();
    const irImpl = await ia.getIRImplementation();
    const irsImpl = await ia.getIRSImplementation();
    const tirImpl = await ia.getTIRImplementation();
    const mcImpl = await ia.getMCImplementation();

    console.log("🔎 IA Token Impl:", tokenImpl);
    console.log("🔎 IA CTR Impl:", ctrImpl);
    console.log("🔎 IA IR Impl:", irImpl);
    console.log("🔎 IA IRS Impl:", irsImpl);
    console.log("🔎 IA TIR Impl:", tirImpl);
    console.log("🔎 IA MC Impl:", mcImpl);

    if (
      tokenImpl === ZERO ||
      ctrImpl === ZERO ||
      irImpl === ZERO ||
      irsImpl === ZERO ||
      tirImpl === ZERO ||
      mcImpl === ZERO
    ) {
      console.error("❌ One or more implementations in ImplementationAuthority are ZERO – check factory deployment.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Failed to inspect ImplementationAuthority implementations:", err);
    process.exit(1);
  }

  //------------------------------------------------------------
  // 🧱 Step 4. Prepare TokenDetails and ClaimDetails arrays
  //------------------------------------------------------------

  // ITREXFactory.TokenDetails (contracts/factory/ITREXFactory.sol)
  // ONCHAINID is set to deployer (non-zero) so TREXFactory WILL NOT call IdFactory.createTokenIdentity().
  const tokenDetails = {
    owner: deployer.address,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    decimals: DECIMALS,
    irs: ZERO,
    ONCHAINID: deployer.address,          // non-zero => bypass IdFactory path
    irAgents: [deployer.address],
    tokenAgents: [deployer.address],
    complianceModules: [],
    complianceSettings: [],
  };

  // ITREXFactory.ClaimDetails
  const claimDetails = {
    claimTopics: [],
    issuers: [],
    issuerClaims: [],
  };

  const tokenDetailsArr = [tokenDetails];
  const claimDetailsArr = [claimDetails];

  console.log("🧱 TokenDetails:", tokenDetails);
  console.log("🧾 ClaimDetails:", claimDetails);

  //------------------------------------------------------------
  // 🚀 Step 5. Deploy Suite via Gateway (static call pre-check)
  //------------------------------------------------------------
  console.log("\n🏗️ Deploying suite via gateway.batchDeployTREXSuite()...");

  let deployTx;
  let deployReceipt;

  try {
    // Pre-flight simulation
    try {
      await gateway.callStatic.batchDeployTREXSuite(tokenDetailsArr, claimDetailsArr);
      console.log("✅ Static call succeeded – proceeding with state-changing tx.");
    } catch (staticErr) {
      console.error("❌ Static call to batchDeployTREXSuite reverted:");
      console.error("   errorName:", staticErr.errorName);
      console.error("   reason:", staticErr.reason || staticErr.message || staticErr);
      throw staticErr;
    }

    deployTx = await gateway.batchDeployTREXSuite(tokenDetailsArr, claimDetailsArr);
    console.log(`⏳ Tx submitted: ${deployTx.hash}`);
    deployReceipt = await deployTx.wait(3);
    console.log("✅ T-REX Suite deployment tx mined in block", deployReceipt.blockNumber);
  } catch (err) {
    console.error("❌ Deployment failed!");
    if (err.errorName) console.error("   Custom error:", err.errorName);
    console.error("   Reason:", err.reason || err.message || err);
    if (err.transactionHash) console.error("   Tx hash:", err.transactionHash);
    process.exit(1);
  }

  //------------------------------------------------------------
  // 🔍 Step 6. Find deployed token address via TREXFactory event
  //------------------------------------------------------------
  let tokenAddress;
  try {
    const trexIface = trexFactory.interface;
    console.log("🧾 Scanning logs for TREXSuiteDeployed...");

    for (const log of deployReceipt.logs) {
      try {
        const parsed = trexIface.parseLog(log);
        console.log(`   Parsed log from ${log.address} as event ${parsed.name}`);
        if (parsed.name === "TREXSuiteDeployed") {
          // prefer named arg if present, fall back to index 0
          tokenAddress = parsed.args._token || parsed.args[0];
          console.log("   ➤ Matched TREXSuiteDeployed, token =", tokenAddress);
          break;
        }
      } catch (_) {
        // ignore logs that don't decode with TREXFactory ABI
      }
    }

    if (!tokenAddress || tokenAddress === ZERO) {
      console.error("⚠️ No TREXSuiteDeployed event found in receipt logs.");
      console.error("   Log addresses in this tx were:");
      for (const log of deployReceipt.logs) {
        console.error("   -", log.address);
      }
      throw new Error("TREXSuiteDeployed event not found – could not determine token address.");
    }

    console.log(`🎯 Token deployed at: ${tokenAddress}`);
  } catch (err) {
    console.error("❌ Could not retrieve token address:", err);
    process.exit(1);
  }

  //------------------------------------------------------------
  // 💰 Step 7. Mint initial supply to deployer
  //------------------------------------------------------------
  try {
    const token = await ethers.getContractAt("Token", tokenAddress, deployer);
    const tokenFns = Object.keys(token.functions || {});
    if (!tokenFns.some(fn => fn.startsWith("mint("))) {
      throw new Error("Token contract has no mint() function.");
    }

    const mintAmount = ethers.utils.parseUnits(INITIAL_SUPPLY, DECIMALS);
    console.log(
      `\n💸 Minting ${INITIAL_SUPPLY} ${TOKEN_SYMBOL} (=${mintAmount.toString()} base units) ` +
      `to ${deployer.address}...`
    );
    const mintTx = await token.mint(deployer.address, mintAmount);
    console.log("⏳ mint() tx:", mintTx.hash);
    await mintTx.wait(2);
    console.log(`✅ Minted ${INITIAL_SUPPLY} ${TOKEN_SYMBOL} to ${deployer.address}`);
  } catch (err) {
    console.error("❌ Error during mint (non-fatal for deployment):");
    console.error("   Reason:", err.reason || err.message || err);
  }

  //------------------------------------------------------------
  // ✅ Step 8. Final Summary
  //------------------------------------------------------------
  console.log("\n🎉 Deployment Completed!");
  console.log("---------------------------");
  console.log(`Token Name:   ${TOKEN_NAME}`);
  console.log(`Token Symbol: ${TOKEN_SYMBOL}`);
  console.log(`Token Addr:   ${tokenAddress}`);
  console.log(`Deployer:     ${deployer.address}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});

