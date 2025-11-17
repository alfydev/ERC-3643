// scripts/checkStatus.js
const { ethers } = require("hardhat");

async function main() {
  const TOKEN_ADDRESS = "0x...";
  const A = "0x..."; // you
  const B = "0x..."; // recipient

  const token = await ethers.getContractAt("Token", TOKEN_ADDRESS);
  const ir = await ethers.getContractAt("IdentityRegistry", await token.identityRegistry());

  console.log("paused:", await token.paused());
  console.log("isVerified(A):", await ir.isVerified(A));
  console.log("isVerified(B):", await ir.isVerified(B));
  console.log("balance(A):", (await token.balanceOf(A)).toString());
  console.log("balance(B):", (await token.balanceOf(B)).toString());
}

main().catch(e=>{console.error(e); process.exit(1);});

