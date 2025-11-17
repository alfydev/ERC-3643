// scripts/unpauseToken.js
const { ethers } = require("hardhat");

async function main() {
  const [agent] = await ethers.getSigners();
  const TOKEN_ADDRESS = "0x...";

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS, agent);

  const paused = await token.paused();
  console.log("Paused before:", paused);

  if (paused) {
    const tx = await token.unpause();
    console.log("⏳ unpause tx:", tx.hash);
    await tx.wait(2);
  }

  console.log("Paused after:", await token.paused());
}

main().catch((e)=>{console.error(e); process.exit(1);});

