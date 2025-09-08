const hre = require('hardhat')
const { ethers } = require('hardhat');
const config = require('../src/config.json')

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

const shares = tokens

// Helper to log price and pool state for charts
async function logPoolState(amm, label) {
    const price = await amm.getPrice()
    const [reserve0, reserve1, totalShares, kValue] = await amm.getPoolInfo()
    
    console.log(`\n=== ${label} ===`)
    console.log(`Price: 1 DPC = ${ethers.utils.formatEther(price)} USDK`)
    console.log(`Reserves: ${ethers.utils.formatEther(reserve0)} DPC, ${ethers.utils.formatEther(reserve1)} USDK`)
    console.log(`Total LP Shares: ${ethers.utils.formatEther(totalShares)}`)
    console.log(`K Value: ${kValue.toString()}`)
}

// Helper to log user balances for UI display
async function logUserBalances(user, userLabel, dappCoin, usdk, amm) {
    const dpcBalance = await dappCoin.balanceOf(user.address)
    const usdkBalance = await usdk.balanceOf(user.address)
    const lpShares = await amm.shares(user.address)
    
    console.log(`${userLabel}: ${ethers.utils.formatEther(dpcBalance)} DPC, ${ethers.utils.formatEther(usdkBalance)} USDK, ${ethers.utils.formatEther(lpShares)} LP`)
}

async function main() {
    console.log('🚀 Enhanced AMM Seed Script - Generating Rich Chart Data\n')
    
    // Fetch accounts
    console.log('Fetching accounts & network...')
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const investor1 = accounts[1]
    const investor2 = accounts[2] 
    const investor3 = accounts[3]
    const investor4 = accounts[4]
    const investor5 = accounts[5] // Additional traders for more data

    // Fetch network
    const { chainId } = await ethers.provider.getNetwork()
    console.log(`Network Chain ID: ${chainId}`)

    // Fetch tokens
    const dappCoin = await ethers.getContractAt('Token', config[chainId].dappCoin.address)
    const usdk = await ethers.getContractAt('Token', config[chainId].usdk.address)
    const amm = await ethers.getContractAt('AMM', config[chainId].amm.address)
    
    console.log(`DappCoin: ${dappCoin.address}`)
    console.log(`USDK: ${usdk.address}`) 
    console.log(`AMM: ${amm.address}`)

    let transaction

    //////////////////////////////////
    // ENHANCED Token Distribution - Give everyone both tokens
    //////////////////////////////////
    console.log('\n📤 Distributing tokens to all investors...')
    
    const investors = [investor1, investor2, investor3, investor4, investor5]
    const distributions = [
        { dpc: tokens(50), usdk: tokens(50) },   // investor1: balanced trader
        { dpc: tokens(20), usdk: tokens(80) },   // investor2: USDK heavy  
        { dpc: tokens(75), usdk: tokens(25) },   // investor3: DPC heavy
        { dpc: tokens(40), usdk: tokens(60) },   // investor4: moderate USDK bias
        { dpc: tokens(30), usdk: tokens(30) }    // investor5: small balanced
    ]

    for(let i = 0; i < investors.length; i++) {
        // Send DPC
        transaction = await dappCoin.connect(deployer).transfer(investors[i].address, distributions[i].dpc)
        await transaction.wait()
        
        // Send USDK  
        transaction = await usdk.connect(deployer).transfer(investors[i].address, distributions[i].usdk)
        await transaction.wait()
        
        console.log(`Investor ${i+1}: ${ethers.utils.formatEther(distributions[i].dpc)} DPC, ${ethers.utils.formatEther(distributions[i].usdk)} USDK`)
    }

    //////////////////////////////////
    // INITIAL LIQUIDITY
    //////////////////////////////////
    console.log('\n💧 Adding initial liquidity...')
    
    const initialLiquidity = tokens(100)
    
    transaction = await dappCoin.connect(deployer).approve(amm.address, initialLiquidity)
    await transaction.wait()
    
    transaction = await usdk.connect(deployer).approve(amm.address, initialLiquidity)
    await transaction.wait()
    
    transaction = await amm.connect(deployer).addLiquidity(initialLiquidity, initialLiquidity)
    await transaction.wait()
    
    await logPoolState(amm, 'Initial Pool State')

    //////////////////////////////////
    // TRADING PHASE 1 - Early Trading Activity
    //////////////////////////////////
    console.log('\n📈 Phase 1: Early Trading Activity...')
    
    const deadline = Math.floor(Date.now() / 1000) + 3600

    // Small trades to establish baseline
    const phase1Trades = [
        { trader: investor1, direction: 'token1', amount: tokens(1), label: 'Small DPC→USDK' },
        { trader: investor2, direction: 'token2', amount: tokens(0.5), label: 'Tiny USDK→DPC' },
        { trader: investor3, direction: 'token1', amount: tokens(2), label: 'Small DPC→USDK' },
        { trader: investor4, direction: 'token2', amount: tokens(1.5), label: 'Small USDK→DPC' }
    ]

    for(let i = 0; i < phase1Trades.length; i++) {
        const trade = phase1Trades[i]
        
        // Approve tokens
        if(trade.direction === 'token1') {
            transaction = await dappCoin.connect(trade.trader).approve(amm.address, trade.amount)
        } else {
            transaction = await usdk.connect(trade.trader).approve(amm.address, trade.amount)
        }
        await transaction.wait()
        
        // Execute swap
        if(trade.direction === 'token1') {
            transaction = await amm.connect(trade.trader).swapToken1(trade.amount, 0, deadline)
        } else {
            transaction = await amm.connect(trade.trader).swapToken2(trade.amount, 0, deadline)
        }
        await transaction.wait()
        
        const price = await amm.getPrice()
        console.log(`Trade ${i+1}: ${trade.label} - New price: ${ethers.utils.formatEther(price)}`)
    }

    //////////////////////////////////
    // LIQUIDITY EXPANSION PHASE  
    //////////////////////////////////
    console.log('\n💧 Phase 2: Additional Liquidity Providers...')

    // investor1 becomes LP - fix precision by adding 1 wei if needed
    const lp1Amount = tokens(25)
    let lp1Token2Needed = await amm.calculateToken2Deposit(lp1Amount)
    
    // Check if precision adjustment needed
    const [reserve0, reserve1] = await amm.getReserves()
    const totalShares = await amm.totalShares()
    
    // Cross-multiplication check: (totalShares * token1 * reserve1) == (totalShares * token2 * reserve0)
    const leftSide = totalShares.mul(lp1Amount).mul(reserve1)
    const rightSide = totalShares.mul(lp1Token2Needed).mul(reserve0)
    
    if (!leftSide.eq(rightSide)) {
        lp1Token2Needed = lp1Token2Needed.add(1) // Add 1 wei to fix precision
    }
    
    transaction = await dappCoin.connect(investor1).approve(amm.address, lp1Amount)
    await transaction.wait()
    transaction = await usdk.connect(investor1).approve(amm.address, lp1Token2Needed)
    await transaction.wait()
    transaction = await amm.connect(investor1).addLiquidity(lp1Amount, lp1Token2Needed)
    await transaction.wait()
    
    console.log(`Investor 1 added liquidity: ${ethers.utils.formatEther(lp1Amount)} DPC, ${ethers.utils.formatEther(lp1Token2Needed)} USDK`)
    await logPoolState(amm, 'After LP Addition #1')

    // investor2 becomes LP with different amount - fix precision
    const lp2Amount = tokens(15)  
    let lp2Token2Needed = await amm.calculateToken2Deposit(lp2Amount)
    
    // Check if precision adjustment needed
    const [reserve0_2, reserve1_2] = await amm.getReserves()
    const totalShares_2 = await amm.totalShares()
    
    const leftSide_2 = totalShares_2.mul(lp2Amount).mul(reserve1_2)
    const rightSide_2 = totalShares_2.mul(lp2Token2Needed).mul(reserve0_2)
    
    if (!leftSide_2.eq(rightSide_2)) {
        lp2Token2Needed = lp2Token2Needed.add(1) // Add 1 wei to fix precision
    }
    
    transaction = await dappCoin.connect(investor2).approve(amm.address, lp2Amount)
    await transaction.wait()
    transaction = await usdk.connect(investor2).approve(amm.address, lp2Token2Needed)
    await transaction.wait()
    transaction = await amm.connect(investor2).addLiquidity(lp2Amount, lp2Token2Needed)
    await transaction.wait()
    
    console.log(`Investor 2 added liquidity: ${ethers.utils.formatEther(lp2Amount)} DPC, ${ethers.utils.formatEther(lp2Token2Needed)} USDK`)
    await logPoolState(amm, 'After LP Addition #2')

    //////////////////////////////////
    // TRADING PHASE 2 - Volume Generation
    //////////////////////////////////
    console.log('\n📊 Phase 3: High Volume Trading for Chart Data...')

    const phase2Trades = [
        { trader: investor3, direction: 'token1', amount: tokens(8), label: 'Large DPC→USDK' },
        { trader: investor4, direction: 'token2', amount: tokens(6), label: 'Medium USDK→DPC' },
        { trader: investor5, direction: 'token1', amount: tokens(3), label: 'Medium DPC→USDK' },
        { trader: investor1, direction: 'token2', amount: tokens(4), label: 'Medium USDK→DPC' },
        { trader: investor2, direction: 'token1', amount: tokens(5), label: 'Medium DPC→USDK' },
        { trader: investor3, direction: 'token2', amount: tokens(7), label: 'Large USDK→DPC' },
        { trader: investor4, direction: 'token1', amount: tokens(2.5), label: 'Small DPC→USDK' },
        { trader: investor5, direction: 'token2', amount: tokens(3.5), label: 'Medium USDK→DPC' },
        { trader: investor1, direction: 'token1', amount: tokens(6), label: 'Large DPC→USDK' },
        { trader: investor2, direction: 'token2', amount: tokens(4.5), label: 'Medium USDK→DPC' }
    ]

    for(let i = 0; i < phase2Trades.length; i++) {
        const trade = phase2Trades[i]
        
        // Approve tokens
        if(trade.direction === 'token1') {
            transaction = await dappCoin.connect(trade.trader).approve(amm.address, trade.amount)
        } else {
            transaction = await usdk.connect(trade.trader).approve(amm.address, trade.amount)
        }
        await transaction.wait()
        
        // Execute swap
        if(trade.direction === 'token1') {
            transaction = await amm.connect(trade.trader).swapToken1(trade.amount, 0, deadline)
        } else {
            transaction = await amm.connect(trade.trader).swapToken2(trade.amount, 0, deadline)
        }
        await transaction.wait()
        
        const price = await amm.getPrice()
        console.log(`Volume Trade ${i+1}: ${trade.label} - Price: ${ethers.utils.formatEther(price)}`)
        
        // Add some variety in timing for realistic data
        if(i % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
        }
    }

    //////////////////////////////////
    // LIQUIDITY MANAGEMENT PHASE
    //////////////////////////////////
    console.log('\n💰 Phase 4: LP Rewards & Withdrawals...')

    // Show LP earnings before withdrawal
    const investor1SharesBefore = await amm.shares(investor1.address)
    const [token1Before, token2Before] = await amm.getLPTokenValue(investor1SharesBefore)
    console.log(`Investor 1 LP position before: ${ethers.utils.formatEther(token1Before)} DPC, ${ethers.utils.formatEther(token2Before)} USDK`)

    // Partial withdrawal to show fee earnings
    const partialWithdraw = investor1SharesBefore.div(3) // Withdraw 1/3
    transaction = await amm.connect(investor1).removeLiquidity(partialWithdraw)
    await transaction.wait()
    
    console.log(`Investor 1 withdrew ${ethers.utils.formatEther(partialWithdraw)} LP shares`)
    await logPoolState(amm, 'After Partial LP Withdrawal')

    // investor3 becomes new LP after seeing the activity - fix precision
    const lp3Amount = tokens(20)
    let lp3Token2Needed = await amm.calculateToken2Deposit(lp3Amount)
    
    // Check if precision adjustment needed
    const [reserve0_3, reserve1_3] = await amm.getReserves()
    const totalShares_3 = await amm.totalShares()
    
    const leftSide_3 = totalShares_3.mul(lp3Amount).mul(reserve1_3)
    const rightSide_3 = totalShares_3.mul(lp3Token2Needed).mul(reserve0_3)
    
    if (!leftSide_3.eq(rightSide_3)) {
        lp3Token2Needed = lp3Token2Needed.add(1) // Add 1 wei to fix precision
    }
    
    transaction = await dappCoin.connect(investor3).approve(amm.address, lp3Amount)
    await transaction.wait()
    transaction = await usdk.connect(investor3).approve(amm.address, lp3Token2Needed)
    await transaction.wait()
    transaction = await amm.connect(investor3).addLiquidity(lp3Amount, lp3Token2Needed)
    await transaction.wait()
    
    console.log(`Investor 3 added liquidity: ${ethers.utils.formatEther(lp3Amount)} DPC, ${ethers.utils.formatEther(lp3Token2Needed)} USDK`)

    //////////////////////////////////
    // FINAL TRADING BURST
    //////////////////////////////////
    console.log('\n🚀 Phase 5: Final Trading Burst...')

    const finalTrades = [
        { trader: investor4, direction: 'token1', amount: tokens(12), label: 'Whale DPC→USDK' },
        { trader: investor5, direction: 'token2', amount: tokens(8), label: 'Large USDK→DPC' },
        { trader: investor1, direction: 'token1', amount: tokens(4), label: 'Medium DPC→USDK' },
        { trader: investor2, direction: 'token2', amount: tokens(6), label: 'Large USDK→DPC' },
        { trader: investor3, direction: 'token1', amount: tokens(3), label: 'Medium DPC→USDK' }
    ]

    for(let i = 0; i < finalTrades.length; i++) {
        const trade = finalTrades[i]
        
        // Approve and execute
        if(trade.direction === 'token1') {
            transaction = await dappCoin.connect(trade.trader).approve(amm.address, trade.amount)
            await transaction.wait()
            transaction = await amm.connect(trade.trader).swapToken1(trade.amount, 0, deadline)
        } else {
            transaction = await usdk.connect(trade.trader).approve(amm.address, trade.amount)
            await transaction.wait()
            transaction = await amm.connect(trade.trader).swapToken2(trade.amount, 0, deadline)
        }
        await transaction.wait()
        
        const price = await amm.getPrice()
        console.log(`Final Trade ${i+1}: ${trade.label} - Price: ${ethers.utils.formatEther(price)}`)
    }

    //////////////////////////////////
    // COMPREHENSIVE FINAL STATE
    //////////////////////////////////
    console.log('\n📊 === FINAL COMPREHENSIVE STATE ===')
    await logPoolState(amm, 'Final Pool State')
    
    console.log('\n👥 Final User Balances:')
    await logUserBalances(deployer, 'Deployer', dappCoin, usdk, amm)
    await logUserBalances(investor1, 'Investor 1', dappCoin, usdk, amm)
    await logUserBalances(investor2, 'Investor 2', dappCoin, usdk, amm)
    await logUserBalances(investor3, 'Investor 3', dappCoin, usdk, amm)
    await logUserBalances(investor4, 'Investor 4', dappCoin, usdk, amm)
    await logUserBalances(investor5, 'Investor 5', dappCoin, usdk, amm)

    // Calculate total volume for analytics
    console.log('\n📈 Trading Analytics:')
    console.log(`Total Trades Executed: ${phase1Trades.length + phase2Trades.length + finalTrades.length}`)
    console.log(`Total LPs: 4 (Deployer + 3 investors)`)
    console.log(`LP Events: 3 additions, 1 withdrawal`)

    const finalPrice = await amm.getPrice()
    const initialPrice = tokens(1) // Started at 1:1
    const priceChange = finalPrice.sub(initialPrice)
    const priceChangePercent = priceChange.mul(10000).div(initialPrice) // basis points
    
    console.log(`Price Movement: ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toString()}bp`)
    console.log(`\n✅ Enhanced seed data generation complete!`)
    console.log(`🎯 Generated rich dataset perfect for:`)
    console.log(`   • Price history charts (${phase1Trades.length + phase2Trades.length + finalTrades.length} data points)`)
    console.log(`   • Volume analysis charts`)
    console.log(`   • Liquidity tracking charts`) 
    console.log(`   • User trading history`)
    console.log(`   • LP earnings analytics`)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})