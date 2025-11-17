// scripts/sendToken.js
const { ethers } = require("hardhat");

async function main() {
  const [sender] = await ethers.getSigners();
  const TOKEN = "0x...";
  const TO    = "0x...";
  const DECIMALS = 18;
  const AMOUNT   = ethers.utils.parseUnits("500", DECIMALS);

  const token = await ethers.getContractAt("Token", TOKEN, sender);

  await token.callStatic.transfer(TO, AMOUNT); // pre-check
  const tx = await token.transfer(TO, AMOUNT);
  console.log("tx:", tx.hash);
  await tx.wait(2);
  console.log("done");
}

main().catch(e => { console.error(e); process.exit(1); });

