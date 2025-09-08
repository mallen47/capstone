// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {

  const Token = await hre.ethers.getContractFactory('Token')
  
  // Deploy Token 1
  let dappCoin = await Token.deploy('DappCoin', 'DPC', '1000000')
  await dappCoin.deployed()
  console.log(`DPC token deployed to: ${dappCoin.address}\n`)

  // Deploy Token 2
  let usdk = await Token.deploy('USD Token', 'USDK', '1000000')
  await usdk.deployed()
  console.log(`USD Token deployed to: ${usdk.address}\n`)

  // Deploy AMM
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm = await AMM.deploy(dappCoin.address, usdk.address)
  console.log(`AMM contract deployed to: ${amm.address}\n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
