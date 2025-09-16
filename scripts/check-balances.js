const { ethers } = require("hardhat")
const config = require('../src/config.json')

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners()
  console.log("Deployer account:", deployer.address)
  
  // Fetch network
  const { chainId } = await ethers.provider.getNetwork()
  console.log(`Checking token balances on network ${chainId}...`)
  
  // Get ETH balance
  const ethBalance = await deployer.getBalance()
  console.log("ETH Balance:", ethers.utils.formatEther(ethBalance), "ETH")
  
  // Get contract addresses from config
  const DPC_ADDRESS = config[chainId].dappCoin.address
  const USD_ADDRESS = config[chainId].usdk.address
  
  console.log(`Using addresses from config.json for chainId ${chainId}:`)
  console.log(`DPC: ${DPC_ADDRESS}`)
  console.log(`USD: ${USD_ADDRESS}`)
  
  // Get token contracts
  const Token = await ethers.getContractFactory("Token")
  const dpc = Token.attach(DPC_ADDRESS)
  const usd = Token.attach(USD_ADDRESS)
  
  // Check token balances
  const dpcBalance = await dpc.balanceOf(deployer.address)
  const usdBalance = await usd.balanceOf(deployer.address)
  
  console.log("DPC Token Balance:", ethers.utils.formatUnits(dpcBalance, 18), "DPC")
  console.log("USD Token Balance:", ethers.utils.formatUnits(usdBalance, 18), "USD")
  
  // Check token details
  console.log("\nToken Details:")
  console.log("DPC Name:", await dpc.name())
  console.log("DPC Symbol:", await dpc.symbol())
  console.log("USD Name:", await usd.name())
  console.log("USD Symbol:", await usd.symbol())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })