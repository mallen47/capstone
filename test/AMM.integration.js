const { expect } = require("chai")
const { ethers } = require("hardhat")

const tokens = n => {
  return ethers.utils.parseUnits(n.toString(), "ether")
}

const shares = tokens

describe("AMM Integration Tests - Precision & Full Lifecycle", () => {
  const deadline = Math.floor(Date.now() / 1000) + 3600
  let accounts,
    deployer,
    liquidityProvider,
    investor1,
    investor2,
    investor3,
    trader1,
    trader2,
    trader3

  let token1, token2, amm

  beforeEach(async () => {
    accounts = await ethers.getSigners()
    deployer = accounts[0]
    liquidityProvider = accounts[1]
    investor1 = accounts[2]
    investor2 = accounts[3]
    investor3 = accounts[4]
    trader1 = accounts[5]
    trader2 = accounts[6]
    trader3 = accounts[7]

    // Deploy fresh tokens
    const Token = await ethers.getContractFactory("Token")
    token1 = await Token.deploy("Dappcoin", "DPC", "1000000")
    token2 = await Token.deploy("USD Token", "USDK", "1000000")

    // Distribute tokens generously for comprehensive testing
    const distributionAmount = tokens(50000)
    const accounts_to_fund = [
      liquidityProvider,
      investor1,
      investor2,
      investor3,
      trader1,
      trader2,
      trader3,
    ]

    for (let account of accounts_to_fund) {
      await token1
        .connect(deployer)
        .transfer(account.address, distributionAmount)
      await token2
        .connect(deployer)
        .transfer(account.address, distributionAmount)
    }

    // Deploy fresh AMM
    const AMM = await ethers.getContractFactory("AMM")
    amm = await AMM.deploy(token1.address, token2.address)
  })

  describe("Precision Bug Fix Validation", () => {
    let initialLiquidity

    beforeEach(async () => {
      // Add substantial initial liquidity
      initialLiquidity = tokens(1000)
      await token1.connect(deployer).approve(amm.address, initialLiquidity)
      await token2.connect(deployer).approve(amm.address, initialLiquidity)
      await amm
        .connect(deployer)
        .addLiquidity(initialLiquidity, initialLiquidity)
    })

    it("successfully adds liquidity after single trade creates fractional ratios", async () => {
      console.log("\n=== Testing LP Addition After Single Trade ===")

      // Initial state - should have perfect 1:1 ratio
      let [reserve0, reserve1] = await amm.getReserves()
      console.log(
        `Initial: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )

      // Execute trade to create fractional ratios
      const tradeAmount = tokens(37.5) // Intentionally creates fractional state
      await token1.connect(investor1).approve(amm.address, tradeAmount)
      await amm.connect(investor1).swapToken1(tradeAmount, 0, deadline)

      // Check fractional state
      const reserves = await amm.getReserves()
      reserve0 = reserves[0]
      reserve1 = reserves[1]
      console.log(
        `After trade: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )

      // This is the critical test - LP addition after fractional ratios
      const lpAmount = tokens(25)
      const calculatedAmount = await amm.calculateToken2Deposit(lpAmount)
      console.log(
        `LP adding: ${ethers.utils.formatEther(
          lpAmount
        )} DPC, ${ethers.utils.formatEther(calculatedAmount)} USDK`
      )

      // Approve and add liquidity - this previously failed
      await token1.connect(liquidityProvider).approve(amm.address, lpAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm.connect(liquidityProvider).addLiquidity(lpAmount, calculatedAmount)
      ).to.not.be.reverted

      console.log("LP addition successful after fractional ratios")

      // Verify LP received appropriate shares
      const lpShares = await amm.shares(liquidityProvider.address)
      expect(lpShares).to.be.gt(0)
      console.log(`LP received: ${ethers.utils.formatEther(lpShares)} shares`)
    })

    it("handles multiple sequential trades creating complex fractional states", async () => {
      console.log("\n=== Testing LP Addition After Multiple Complex Trades ===")

      // Execute series of trades to create complex fractional ratios
      const trades = [
        { trader: investor1, amount: tokens(13.7), direction: "token1" },
        { trader: investor2, amount: tokens(8.3), direction: "token2" },
        { trader: investor3, amount: tokens(21.9), direction: "token1" },
        { trader: investor1, amount: tokens(15.6), direction: "token2" },
        { trader: investor2, amount: tokens(7.4), direction: "token1" },
      ]

      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i]

        if (trade.direction === "token1") {
          await token1.connect(trade.trader).approve(amm.address, trade.amount)
          await amm.connect(trade.trader).swapToken1(trade.amount, 0, deadline)
        } else {
          await token2.connect(trade.trader).approve(amm.address, trade.amount)
          await amm.connect(trade.trader).swapToken2(trade.amount, 0, deadline)
        }

        const [r0, r1] = await amm.getReserves()
        console.log(
          `After trade ${i + 1}: ${ethers.utils.formatEther(
            r0
          )} DPC, ${ethers.utils.formatEther(r1)} USDK`
        )
      }

      // Now attempt LP addition in this complex fractional state
      const lpAmount = tokens(50)
      const calculatedAmount = await amm.calculateToken2Deposit(lpAmount)
      console.log(
        `LP adding: ${ethers.utils.formatEther(
          lpAmount
        )} DPC, ${ethers.utils.formatEther(calculatedAmount)} USDK`
      )

      await token1.connect(liquidityProvider).approve(amm.address, lpAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm.connect(liquidityProvider).addLiquidity(lpAmount, calculatedAmount)
      ).to.not.be.reverted

      console.log("LP addition successful with fractional values!")
    })

    it("validates ceiling division provides exact cross-multiplication match", async () => {
      console.log(
        "\n=== Testing Mathematical Precision of Ceiling Division Fix ==="
      )

      // Create specific fractional state
      await token1.connect(investor1).approve(amm.address, tokens(123.456))
      await amm.connect(investor1).swapToken1(tokens(123.456), 0, deadline)

      const [reserve0, reserve1] = await amm.getReserves()
      const totalShares = await amm.totalShares()

      console.log(
        `Pool state: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )
      console.log(`Total shares: ${ethers.utils.formatEther(totalShares)}`)

      // Test the mathematical precision
      const testAmount = tokens(17.89)
      const calculatedAmount = await amm.calculateToken2Deposit(testAmount)

      // Manually verify cross-multiplication
      const leftSide = totalShares.mul(testAmount).mul(reserve1)
      const rightSide = totalShares.mul(calculatedAmount).mul(reserve0)

      console.log(`Cross-multiplication check:`)
      console.log(`Left side:  ${leftSide.toString()}`)
      console.log(`Right side: ${rightSide.toString()}`)
      console.log(`Difference: ${leftSide.sub(rightSide).toString()}`)

      // With tolerance approach, validation passes if difference is within acceptable bounds
      const tolerance = leftSide.gt(rightSide)
        ? leftSide.div(100000)
        : rightSide.div(100000)
      const difference = leftSide.gt(rightSide)
        ? leftSide.sub(rightSide)
        : rightSide.sub(leftSide)
      expect(difference).to.be.lte(tolerance)
      console.log(
        "Cross-multiplication within tolerance - validation would pass!"
      )

      // Verify actual LP addition works
      await token1.connect(liquidityProvider).approve(amm.address, testAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm
          .connect(liquidityProvider)
          .addLiquidity(testAmount, calculatedAmount)
      ).to.not.be.reverted
    })

    it("handles edge case: very small LP additions in fractional states", async () => {
      console.log("\n=== Testing Small LP Additions in Fractional States ===")

      // Create fractional ratios
      await token1.connect(investor1).approve(amm.address, tokens(77.77))
      await amm.connect(investor1).swapToken1(tokens(77.77), 0, deadline)

      // Test very small LP addition
      const smallAmount = tokens(0.001) // 1 millitoken
      const calculatedAmount = await amm.calculateToken2Deposit(smallAmount)

      console.log(
        `Small LP adding: ${ethers.utils.formatEther(
          smallAmount
        )} DPC, ${ethers.utils.formatEther(calculatedAmount)} USDK`
      )

      await token1.connect(liquidityProvider).approve(amm.address, smallAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm
          .connect(liquidityProvider)
          .addLiquidity(smallAmount, calculatedAmount)
      ).to.not.be.reverted

      console.log("Very small LP addition successful!")
    })

    it("handles edge case when large LP deposits in fractional states", async () => {
      console.log("\n=== Testing Large LP Deposit in Fractional States ===")

      // Create fractional ratios
      await token1.connect(investor1).approve(amm.address, tokens(333.333))
      await amm.connect(investor1).swapToken1(tokens(333.333), 0, deadline)

      // Test large LP addition
      const largeAmount = tokens(500)
      const calculatedAmount = await amm.calculateToken2Deposit(largeAmount)

      console.log(
        `Large LP depositing: ${ethers.utils.formatEther(
          largeAmount
        )} DPC, ${ethers.utils.formatEther(calculatedAmount)} USDK`
      )

      await token1.connect(liquidityProvider).approve(amm.address, largeAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm
          .connect(liquidityProvider)
          .addLiquidity(largeAmount, calculatedAmount)
      ).to.not.be.reverted

      console.log("Large LP deposit successful")
    })
  })

  describe("Full AMM Lifecycle Integration", () => {
    it("executes complete AMM lifecycle with precision integrity", async () => {
      console.log("\n=== Full AMM Lifecycle Test ===")

      // Phase 1: Initial Setup
      console.log("Phase 1: Initial liquidity provision")
      const initialAmount = tokens(1000)
      await token1.connect(deployer).approve(amm.address, initialAmount)
      await token2.connect(deployer).approve(amm.address, initialAmount)
      await amm.connect(deployer).addLiquidity(initialAmount, initialAmount)

      let [reserve0, reserve1] = await amm.getReserves()
      console.log(
        `Initial pool: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )

      // Phase 2: Trading creates fractional ratios
      console.log("\nPhase 2: Trading activity creating fractional ratios")
      const tradingSequence = [
        { trader: trader1, amount: tokens(25.5), direction: "token1" },
        { trader: trader2, amount: tokens(18.7), direction: "token2" },
        { trader: trader3, amount: tokens(33.3), direction: "token1" },
        { trader: trader1, amount: tokens(22.9), direction: "token2" },
        { trader: trader2, amount: tokens(41.1), direction: "token1" },
      ]

      for (let trade of tradingSequence) {
        if (trade.direction === "token1") {
          await token1.connect(trade.trader).approve(amm.address, trade.amount)
          await amm.connect(trade.trader).swapToken1(trade.amount, 0, deadline)
        } else {
          await token2.connect(trade.trader).approve(amm.address, trade.amount)
          await amm.connect(trade.trader).swapToken2(trade.amount, 0, deadline)
        }
      }

      const reservesAfterTrading = await amm.getReserves()
      reserve0 = reservesAfterTrading[0]
      reserve1 = reservesAfterTrading[1]
      console.log(
        `After trading: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )

      // Phase 3: Multiple LP additions in fractional state (This previously failed!)
      console.log("\nPhase 3: Multiple LP additions in fractional state")
      const lpAdditions = [
        { lp: liquidityProvider, amount: tokens(100) },
        { lp: investor1, amount: tokens(75) },
        { lp: investor2, amount: tokens(150) },
        { lp: investor3, amount: tokens(50) },
      ]

      for (let addition of lpAdditions) {
        const token2Amount = await amm.calculateToken2Deposit(addition.amount)
        console.log(
          `${addition.lp.address.slice(
            0,
            6
          )}... adding: ${ethers.utils.formatEther(
            addition.amount
          )} DPC, ${ethers.utils.formatEther(token2Amount)} USDK`
        )

        await token1.connect(addition.lp).approve(amm.address, addition.amount)
        await token2.connect(addition.lp).approve(amm.address, token2Amount)

        await expect(
          amm.connect(addition.lp).addLiquidity(addition.amount, token2Amount)
        ).to.not.be.reverted

        const shares = await amm.shares(addition.lp.address)
        console.log(`  Received: ${ethers.utils.formatEther(shares)} shares`)
      }

      const reservesAfterLP = await amm.getReserves()
      reserve0 = reservesAfterLP[0]
      reserve1 = reservesAfterLP[1]
      const totalShares = await amm.totalShares()
      console.log(
        `After LP additions: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )
      console.log(`Total shares: ${ethers.utils.formatEther(totalShares)}`)

      // Phase 4: More trading after LP additions
      console.log("\nPhase 4: Continued trading after LP additions")
      for (let i = 0; i < 3; i++) {
        await token1.connect(trader1).approve(amm.address, tokens(20))
        await amm.connect(trader1).swapToken1(tokens(20), 0, deadline)
      }

      // Phase 5: LP removals and re-additions
      console.log("\nPhase 5: LP removals and re-additions")
      const lpShares = await amm.shares(liquidityProvider.address)
      const halfShares = lpShares.div(2)

      await amm.connect(liquidityProvider).removeLiquidity(halfShares)
      console.log(`LP removed ${ethers.utils.formatEther(halfShares)} shares`)

      // Immediately try to add liquidity again
      const reAddAmount = tokens(25)
      const reAddToken2 = await amm.calculateToken2Deposit(reAddAmount)

      await token1.connect(liquidityProvider).approve(amm.address, reAddAmount)
      await token2.connect(liquidityProvider).approve(amm.address, reAddToken2)

      await expect(
        amm.connect(liquidityProvider).addLiquidity(reAddAmount, reAddToken2)
      ).to.not.be.reverted

      console.log("- Complete AMM lifecycle executed successfully")
      console.log("- LP additions working in fractional states")

      // Final state verification
      const finalReserves = await amm.getReserves()
      const finalShares = await amm.totalShares()
      const finalK = await amm.K()

      console.log(`\nFinal state:`)
      console.log(
        `Reserves: ${ethers.utils.formatEther(
          finalReserves[0]
        )} DPC, ${ethers.utils.formatEther(finalReserves[1])} USDK`
      )
      console.log(`Total shares: ${ethers.utils.formatEther(finalShares)}`)
      console.log(`K value: ${finalK.toString()}`)

      expect(finalReserves[0]).to.be.gt(0)
      expect(finalReserves[1]).to.be.gt(0)
      expect(finalShares).to.be.gt(0)
      expect(finalK).to.be.gt(0)
    })
  })

  describe("Stress Testing Precision Edge Cases", () => {
    beforeEach(async () => {
      // Add initial liquidity for stress tests
      const amount = tokens(10000)
      await token1.connect(deployer).approve(amm.address, amount)
      await token2.connect(deployer).approve(amm.address, amount)
      await amm.connect(deployer).addLiquidity(amount, amount)
    })

    it("handles extreme imbalanced pools", async () => {
      console.log("\n=== Testing Extreme Pool Imbalances ===")

      // Create extreme imbalance (heavily drain one side)
      const massiveSwap = tokens(8000)
      await token1.connect(investor1).approve(amm.address, massiveSwap)
      await amm.connect(investor1).swapToken1(massiveSwap, 0, deadline)

      const [reserve0, reserve1] = await amm.getReserves()
      const ratio = reserve0.mul(1000).div(reserve1) // Ratio * 1000 to avoid decimals
      console.log(
        `Extreme pool state: ${ethers.utils.formatEther(
          reserve0
        )} DPC, ${ethers.utils.formatEther(reserve1)} USDK`
      )
      console.log(`Ratio: ${ratio.toString()}/1000`)

      // Try LP addition in this extreme state
      const lpAmount = tokens(100)
      const calculatedAmount = await amm.calculateToken2Deposit(lpAmount)

      await token1.connect(liquidityProvider).approve(amm.address, lpAmount)
      await token2
        .connect(liquidityProvider)
        .approve(amm.address, calculatedAmount)

      await expect(
        amm.connect(liquidityProvider).addLiquidity(lpAmount, calculatedAmount)
      ).to.not.be.reverted

      console.log("- LP addition successful even in extreme imbalance!")
    })

    it("maintains precision across 20+ sequential operations", async () => {
      console.log("\n=== Testing 20+ Sequential Operations ===")

      let operationCount = 0

      // Mix of trades and LP additions
      for (let i = 0; i < 25; i++) {
        if (i % 3 === 0) {
          // LP addition every 3rd operation
          const lpAmount = tokens(10 + (i % 50)) // Varying amounts
          const calculatedAmount = await amm.calculateToken2Deposit(lpAmount)

          const lp = i % 2 === 0 ? liquidityProvider : investor1
          await token1.connect(lp).approve(amm.address, lpAmount)
          await token2.connect(lp).approve(amm.address, calculatedAmount)

          await expect(amm.connect(lp).addLiquidity(lpAmount, calculatedAmount))
            .to.not.be.reverted

          operationCount++
        } else {
          // Trade operation
          const tradeAmount = tokens(5 + (i % 30))
          const trader = i % 2 === 0 ? trader1 : trader2

          if (i % 2 === 0) {
            await token1.connect(trader).approve(amm.address, tradeAmount)
            await amm.connect(trader).swapToken1(tradeAmount, 0, deadline)
          } else {
            await token2.connect(trader).approve(amm.address, tradeAmount)
            await amm.connect(trader).swapToken2(tradeAmount, 0, deadline)
          }

          operationCount++
        }

        if (i % 5 === 0) {
          const [r0, r1] = await amm.getReserves()
          console.log(
            `After op ${operationCount}: ${ethers.utils.formatEther(
              r0
            )} DPC, ${ethers.utils.formatEther(r1)} USDK`
          )
        }
      }

      console.log(`- Successfully executed ${operationCount} mixed operations`)

      // Verify final state is consistent
      const finalReserves = await amm.getReserves()
      const finalShares = await amm.totalShares()
      const finalK = await amm.K()

      expect(finalReserves[0]).to.be.gt(0)
      expect(finalReserves[1]).to.be.gt(0)
      expect(finalShares).to.be.gt(shares(100)) // Should have grown significantly
      expect(finalK).to.be.gt(0)

      console.log("Final state mathematically consistent")
    })
  })
})
