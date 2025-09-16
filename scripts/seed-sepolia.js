const { ethers } = require('hardhat')
const config = require('../src/config.json')

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

async function main() {
    console.log('🚀 Sepolia AMM Seed Script - Basic Pool Setup\n')
    
    // Get deployer (your account)
    const [deployer] = await ethers.getSigners()
    console.log('Deployer:', deployer.address)
    
    // Fetch network
    const { chainId } = await ethers.provider.getNetwork()
    console.log(`Network Chain ID: ${chainId}`)

    // Get contracts
    const dappCoin = await ethers.getContractAt('Token', config[chainId].dappCoin.address)
    const usdk = await ethers.getContractAt('Token', config[chainId].usdk.address)
    const amm = await ethers.getContractAt('AMM', config[chainId].amm.address)
    
    console.log(`DappCoin: ${dappCoin.address}`)
    console.log(`USDK: ${usdk.address}`)
    console.log(`AMM: ${amm.address}`)

    // Check initial balances
    const dpcBalance = await dappCoin.balanceOf(deployer.address)
    const usdkBalance = await usdk.balanceOf(deployer.address)
    console.log(`\nInitial Balances:`)
    console.log(`DPC: ${ethers.utils.formatEther(dpcBalance)}`)
    console.log(`USDK: ${ethers.utils.formatEther(usdkBalance)}`)

    // Add initial liquidity
    console.log('\n💧 Adding initial liquidity (100 DPC + 100 USDK)...')
    
    const liquidityAmount = tokens(100)
    
    let transaction = await dappCoin.connect(deployer).approve(amm.address, liquidityAmount)
    await transaction.wait()
    
    transaction = await usdk.connect(deployer).approve(amm.address, liquidityAmount)
    await transaction.wait()
    
    transaction = await amm.connect(deployer).addLiquidity(liquidityAmount, liquidityAmount)
    await transaction.wait()
    
    // Check pool state
    const [reserve0, reserve1, totalShares, kValue] = await amm.getPoolInfo()
    const price = await amm.getPrice()
    
    console.log(`\n=== Pool Created Successfully ===`)
    console.log(`Price: 1 DPC = ${ethers.utils.formatEther(price)} USDK`)
    console.log(`Reserves: ${ethers.utils.formatEther(reserve0)} DPC, ${ethers.utils.formatEther(reserve1)} USDK`)
    console.log(`Total LP Shares: ${ethers.utils.formatEther(totalShares)}`)
    console.log(`K Value: ${kValue.toString()}`)
    
    // Check remaining balances
    const dpcBalanceAfter = await dappCoin.balanceOf(deployer.address)
    const usdkBalanceAfter = await usdk.balanceOf(deployer.address)
    const lpShares = await amm.shares(deployer.address)
    
    console.log(`\nFinal Balances:`)
    console.log(`DPC: ${ethers.utils.formatEther(dpcBalanceAfter)}`)
    console.log(`USDK: ${ethers.utils.formatEther(usdkBalanceAfter)}`)
    console.log(`LP Shares: ${ethers.utils.formatEther(lpShares)}`)
    
    console.log(`\n✅ Sepolia AMM seeded successfully!`)
    console.log(`🎯 You can now test:`)
    console.log(`   • Token swapping in your frontend`)
    console.log(`   • Adding/removing liquidity`)
    console.log(`   • Price impact visualization`)
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})