const hre = require('hardhat')
const { ethers } = require('hardhat');
const config = require('../src/config.json')

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

// shares are not tokens but they have the same precision, so we can create
// a shares helper that does the same kind of numeric formatting
const shares = tokens

async function main() {
    // Fetch accounts
    console.log('Fetching accounts & network')
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const investor1 = accounts[1]
    const investor2 = accounts[2]
    const investor3 = accounts[3]
    const investor4 = accounts[4]

    // Fetch network
    const { chainId } = await ethers.provider.getNetwork()
    console.log(`Fetching token and transfering to accounts...\n`)

    // Fetch DPC Token
    const dappCoin = await ethers.getContractAt('Token', config[chainId].dappCoin.address)
    console.log(`DappCoin token fetched: ${dappCoin.address}\n`)

    // Fetch USDK Token
    const usdk = await ethers.getContractAt('Token', config[chainId].usdk.address)
    console.log(`USDK token fetched: ${usdk.address}\n`)

    //////////////////////////////////
    // Distribute tokens to investors

    let transaction

    // send DPC to investor 1
    transaction = await dappCoin.connect(deployer).transfer(investor1.address, tokens(10))
    await transaction.wait()

    // send USDK to investor 2
    transaction = await usdk.connect(deployer).transfer(investor2.address, tokens(10))
    await transaction.wait()

    // send DPC to investor 3
    transaction = await dappCoin.connect(deployer).transfer(investor3.address, tokens(10))
    await transaction.wait()

    // send USDK to investor 4
    transaction = await usdk.connect(deployer).transfer(investor4.address, tokens(10))
    await transaction.wait()

    
    ////////////////////////
    // Add liquidity

    let amount = tokens(100)

    // Fetch AMM
    const amm = await ethers.getContractAt('AMM', config[chainId].amm.address)
    console.log(`AMM fetched: ${amm.address}\n`)

    transaction = await dappCoin.connect(deployer).approve(amm.address, amount)
    await transaction.wait()

    transaction = await usdk.connect(deployer).approve(amm.address, amount)
    await transaction.wait()

    // Deployer adds liquidity
    console.log(`Adding liquidity...\n`)
    transaction = await amm.connect(deployer).addLiquidity(amount, amount)
    await transaction.wait()

    /////////////////////////////////
    // Investor 1 swaps: DPC -> USDK

    console.log(`Investor 1 swaps...\n`)

    // Investor 1 approves all tokens
    transaction = await dappCoin.connect(investor1).approve(amm.address, tokens(10))
    await transaction.wait()

    // Investor 1 swaps 1 token
    transaction = await amm.connect(investor1).swapToken1(
        tokens(1),
        0,
        Math.floor(Date.now() / 1000) + 3600
    )
    await transaction.wait()


    /////////////////////////////////
    // Investor 2 swaps: USDK -> DPC

    console.log(`Investor 2 swaps...\n`)

    // Investor 2 approves all tokens
    transaction = await usdk.connect(investor2).approve(amm.address, tokens(10))
    await transaction.wait()

    // Investor 2 swaps 1 token
    transaction = await amm.connect(investor2).swapToken2(
        tokens(1),
        0,
        Math.floor(Date.now() / 1000) + 3600
    )
    await transaction.wait()

    
    /////////////////////////////////
    // Investor 3 swaps: DPC -> USDK

    console.log(`Investor 3 swaps...\n`)

    // Investor 3 approves all tokens
    transaction = await dappCoin.connect(investor3).approve(amm.address, tokens(10))
    await transaction.wait()

    // Investor 3 swaps 1 token
    transaction = await amm.connect(investor3).swapToken1(
        tokens(10),
        0,
        Math.floor(Date.now() / 1000) + 3600
    )
    await transaction.wait()

    
    /////////////////////////////////
    // Investor 4 swaps: USDK -> DPC

    console.log(`Investor 4 swaps...\n`)

    // Investor 4 approves all tokens
    transaction = await usdk.connect(investor4).approve(amm.address, tokens(10))
    await transaction.wait()

    // Investor 4 swaps 5 token
    transaction = await amm.connect(investor4).swapToken2(
        tokens(5),
        0,
        Math.floor(Date.now() / 1000) + 3600
    )
    await transaction.wait()

    console.log(`Finished.\n`)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})