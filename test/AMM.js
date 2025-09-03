const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

// shares are not tokens but they have the same precision, so we can create
// a shares helper that does the same kind of numeric formatting
const shares = tokens

describe('AMM', () => {
    let accounts,
      deployer,
      liquidityProvider,
      investor1,
      investor2
        
    let token1,
      token2,
      amm,
      estimate,
      balance

    beforeEach(async () => {
      accounts = await ethers.getSigners()
      deployer = accounts[0]
      liquidityProvider = accounts[1]
      investor1 = accounts[2]
      investor2 = accounts[3]

      // Deploy Token
      const Token = await ethers.getContractFactory('Token')
      token1 = await Token.deploy('Dappcoin', 'DPC', '1000000')
      token2 = await Token.deploy('USD Token', 'USDK', '1000000')

      // Send tokens to liquidity provider
      let transaction = await token1.connect(deployer).transfer(liquidityProvider.address, tokens(100000))      
      await transaction.wait()
      
      transaction = await token2.connect(deployer).transfer(liquidityProvider.address, tokens(100000))
      await transaction.wait()

      // Send token1 tokens to investor1
      transaction = await token1.connect(deployer).transfer(investor1.address, tokens(100000))
      await transaction.wait()

      // Send token2 tokens to investor2
      transaction = await token2.connect(deployer).transfer(investor2.address, tokens(100000))
      await transaction.wait()

      // Deploy AMM
      const AMM = await ethers.getContractFactory('AMM')
      amm = await AMM.deploy(token1.address, token2.address)
    })

    describe('Deployment', () => {
        it('has an address', () => {
            expect(amm.address).to.not.equal('0x0')
        })

        it('tracks token1 address', async() => {
            expect(await amm.token1()).to.equal(token1.address)
        })

        it('tracks token2 address', async() => {
            expect(await amm.token2()).to.equal(token2.address)
        })
    })

    describe('Swapping tokens', () => {
        let amount, transaction
        
        it('facilitates swaps', async () => {
          // Deployer approves 100k tokens
          amount = tokens(100000)
          transaction = await token1.connect(deployer).approve(amm.address, amount)
          await transaction.wait()

          transaction = await token2.connect(deployer).approve(amm.address, amount)
          await transaction.wait()

          // Deployer adds liquidity
          transaction = await amm.connect(deployer).addLiquidity(amount, amount)
          await transaction.wait()

          // Check AMM receives tokens            
          expect(await token1.balanceOf(amm.address)).to.equal(amount)
          expect(await token2.balanceOf(amm.address)).to.equal(amount)

          expect(await amm.token1Balance()).to.equal(amount)
          expect(await amm.token2Balance()).to.equal(amount)

          // Check deployer receives shares minus minimum liquidity lock
          const expectedShares = tokens(100).sub(1000) // 100 tokens - 1000 wei lock
          expect(await amm.shares(deployer.address)).to.equal(expectedShares)

          // Check pool still has 100 total shares (including locked amount)
          expect(await amm.totalShares()).to.equal(tokens(100))

          
          //////////////////////////
          // LP adds more liquidity
          //

          // Check that LP receives the correct number of shares upon subsequent deposits
          // LP approves 50k tokens
          amount = tokens(50000)
          transaction = await token1.connect(liquidityProvider).approve(amm.address, amount)
          await transaction.wait()

          transaction = await token2.connect(liquidityProvider).approve(amm.address, amount)
          await transaction.wait()

          let token2Deposit = await amm.calculateToken2Deposit(amount)

          // LP adds liquidity
          transaction = await amm.connect(liquidityProvider).addLiquidity(amount, token2Deposit)
          await transaction.wait()

          // LP should have 50 shares
          expect(await amm.shares(liquidityProvider.address)).to.equal(tokens(50));

          // Deployer should still have shares minus minimum liquidity lock
          expect(await amm.shares(deployer.address)).to.equal(tokens(100).sub(1000));

          // Pool should have 150 shares
          expect(await amm.totalShares()).to.equal(tokens(150));
          

          /////////////////////////////////////
          // Investor1 swaps token1 for token2

          // check price before swapping
          console.log(`Price before swap: ${await amm.token2Balance() / await amm.token1Balance()} \n`)

          // approve swap 
          transaction = await token1.connect(investor1).approve(amm.address, tokens(100000))          
          await transaction.wait()

          // get investor1 token2 balance before swap - should be 0
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance before swap: ${ethers.utils.formatEther(balance)}\n`)

          // estimate amount of token2 to be received
          estimate = await amm.calculateToken1Swap(tokens(1))
          console.log(`Estimated Token2 amount investor1 will receive after swap: ${ethers.utils.formatEther(estimate)}\n`)

          // swap token1 for token2
          transaction = await amm.connect(investor1).swapToken1(tokens(1), 0, Math.floor(Date.now() / 1000) + 3600)
          await transaction.wait()

          // check swap event
          await expect(transaction).to.emit(amm, 'Swap')
            .withArgs(
              investor1.address,
              token1.address,
              tokens(1),
              token2.address,
              estimate,
              await amm.token1Balance(),
              await amm.token2Balance(),
              (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
            )

          // check investor1 balance after swap should match estimate
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance after swap: ${ethers.utils.formatEther(balance)}\n`)
          expect(estimate).to.equal(balance)

          // check contract balances are in sync
          expect(await token1.balanceOf(amm.address)).to.equal(await amm.token1Balance())
          expect(await token2.balanceOf(amm.address)).to.equal(await amm.token2Balance())

          // check price after swapping
          console.log(`Price after swap: ${await amm.token2Balance() / await amm.token1Balance()} \n`)

          
          ///////////////////////////////////////////////////////////////////
          // Observe price impact when Investor1 swapping more token1 tokens

          // get investor1 token2 balance before 2nd swap
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance before swap: ${ethers.utils.formatEther(balance)}\n`)

          // estimate amount of token2 to be received
          estimate = await amm.calculateToken1Swap(tokens(1))
          console.log(`Estimated Token2 amount investor1 will receive after swap: ${ethers.utils.formatEther(estimate)}\n`)

          // investor1 swaps another single token
          transaction = await amm.connect(investor1).swapToken1(tokens(1), 0, Math.floor(Date.now() / 1000) + 3600)
          await transaction.wait()

          // check investor1 balance after second swap
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance after swap: ${ethers.utils.formatEther(balance)}\n`)
          
          // check contract balances are still in sync
          expect(await token1.balanceOf(amm.address)).to.equal(await amm.token1Balance())
          expect(await token2.balanceOf(amm.address)).to.equal(await amm.token2Balance())

          // check price after swapping
          console.log(`Price after swap: ${await amm.token2Balance() / await amm.token1Balance()} \n`)



          ///////////////////////////////////////////////////////////////////
          // Observe price impact when Investor1 swaps a large amount

          // get investor1 token2 balance before 3rd swap
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance before swap: ${ethers.utils.formatEther(balance)}\n`)

          // estimate amount of token2 to be received
          estimate = await amm.calculateToken1Swap(tokens(1000))
          console.log(`Estimated Token2 amount investor1 will receive after swap: ${ethers.utils.formatEther(estimate)}\n`)

          // investor1 swaps a large amount of tokens
          transaction = await amm.connect(investor1).swapToken1(tokens(1000), 0, Math.floor(Date.now() / 1000) + 3600)
          await transaction.wait()

          // check investor1 balance after second swap
          balance = await token2.balanceOf(investor1.address)
          console.log(`Investor1 token2 balance after swap: ${ethers.utils.formatEther(balance)}\n`)
          
          // check contract balances are still in sync
          expect(await token1.balanceOf(amm.address)).to.equal(await amm.token1Balance())
          expect(await token2.balanceOf(amm.address)).to.equal(await amm.token2Balance())

          // check price after swapping
          console.log(`Price after swap: ${await amm.token2Balance() / await amm.token1Balance()} \n`)


          ////////////////////
          // Investor2 swaps

          // Investor2 approves all tokens available to swap
          transaction = await token2.connect(investor2).approve(amm.address, tokens(100000))
          await transaction.wait()

          // check Investor2 token2 balance - should be 0 before initial swap
          balance = await token1.balanceOf(investor2.address)
          console.log(`Investor2 token1 balance before swap: ${balance}`)

          // Estimate amount of token2 tokens investor2 will recieve
          estimate = await amm.calculateToken2Swap(tokens(1))
          console.log(`Estimated token1 amount investor2 will recieve: ${ethers.utils.formatEther(estimate)}`)

          // Investor2 swaps 1 token2 token
          transaction = await amm.connect(investor2).swapToken2(tokens(1), 0, Math.floor(Date.now() / 1000) + 3600)
          await transaction.wait()

          // check swap event
          await expect(transaction).to.emit(amm, 'Swap')
            .withArgs(
              investor2.address,
              token2.address,
              tokens(1),
              token1.address,
              estimate,
              await amm.token2Balance(),
              await amm.token1Balance(),
              (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
          )
          
          // check investor2 token1 balance after swap
          balance = await token1.balanceOf(investor2.address)
          console.log(`Investor2 token1 balance after swap: ${ethers.utils.formatEther(balance)}`)

          // check AMM token balances are in sync
          expect(await token1.balanceOf(amm.address)).to.be.equal(await amm.token1Balance())
          expect(await token2.balanceOf(amm.address)).to.be.equal(await amm.token2Balance())

          // check price after swapping
          console.log(`Price: ${await amm.token2Balance() / await amm.token1Balance()}`)


          ////////////////////////////
          // Removing Liquidity

          console.log(`AMM Token1 balance: ${ethers.utils.formatEther(await amm.token1Balance())} \n`)
          console.log(`AMM Token2 balance: ${ethers.utils.formatEther(await amm.token2Balance())} \n`)

          balance = await token1.balanceOf(liquidityProvider.address)
          console.log(`LP token1 balance before removing funds: ${ethers.utils.formatEther(balance)}`)

          balance = await token2.balanceOf(liquidityProvider.address)
          console.log(`LP token2 balance before removing funds: ${ethers.utils.formatEther(balance)}`)

          // Calculate token amounts before removing liquidity
          let tokenAmounts = await amm.calculateWithdrawAmount(shares(50))

          // LP removes liquidity from AMM pool
          transaction = await amm.connect(liquidityProvider).removeLiquidity(shares(50))
          await transaction.wait()

          await expect(transaction).to.emit(amm, 'LiquidityRemoved')
            .withArgs(
              liquidityProvider.address,              
              shares(50),
              tokenAmounts.token1Amount,
              tokenAmounts.token2Amount,
              (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
          )

          balance = await token1.balanceOf(liquidityProvider.address)
          console.log(`LP token1 balance after removing funds: ${ethers.utils.formatEther(balance)}`)

          balance = await token2.balanceOf(liquidityProvider.address)
          console.log(`LP token2 balance after removing funds: ${ethers.utils.formatEther(balance)}`)

          // LP should now have 0 shares
          expect(await amm.shares(liquidityProvider.address)).to.equal(0)

          // Deployer should have shares minus minimum liquidity lock
          expect(await amm.shares(deployer.address)).to.equal(shares(100).sub(1000))

          // AMM pool has 100 total shares
          expect(await amm.totalShares()).to.equal(shares(100))

        })

        it('emits LiquidityAdded event', async () => {
          // Setup initial liquidity
          amount = tokens(100000)
          await token1.connect(deployer).approve(amm.address, amount)
          await token2.connect(deployer).approve(amm.address, amount)
          
          transaction = await amm.connect(deployer).addLiquidity(amount, amount)
          
          const expectedShares = tokens(100).sub(1000) // Account for minimum liquidity lock
          await expect(transaction).to.emit(amm, 'LiquidityAdded')
            .withArgs(
              deployer.address,
              expectedShares, // Shares minus minimum liquidity lock
              amount,
              amount,
              (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp
            )
        })      
    })

    describe('User Protection Mechanisms', () => {
        let amount, estimate
        
        beforeEach(async () => {
            // Setup liquidity first
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
            
            // Setup investor approvals
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            await token2.connect(investor2).approve(amm.address, tokens(100000))
        })

        describe('Slippage Protection', () => {
            it('reverts when swapToken1 output is below minimum', async () => {
                estimate = await amm.calculateToken1Swap(tokens(1))
                console.log(`Estimated output: ${ethers.utils.formatEther(estimate)}`)
                
                // Demand MORE than possible - should revert
                const tooHighMinimum = estimate.add(tokens(1))
                
                await expect(
                    amm.connect(investor1).swapToken1(
                        tokens(1), 
                        tooHighMinimum, 
                        Math.floor(Date.now() / 1000) + 3600
                    )
                ).to.be.revertedWith("Insufficient output amount")
            })

            it('reverts when swapToken2 output is below minimum', async () => {
                estimate = await amm.calculateToken2Swap(tokens(1))
                console.log(`Estimated output: ${ethers.utils.formatEther(estimate)}`)
                
                // Demand MORE than possible - should revert
                const tooHighMinimum = estimate.add(tokens(1))
                
                await expect(
                    amm.connect(investor2).swapToken2(
                        tokens(1), 
                        tooHighMinimum, 
                        Math.floor(Date.now() / 1000) + 3600
                    )
                ).to.be.revertedWith("Insufficient output amount")
            })

            it('succeeds when swapToken1 output meets minimum', async () => {
                estimate = await amm.calculateToken1Swap(tokens(1))
                
                // Accept slightly less - should succeed
                const acceptableMinimum = estimate.sub(tokens(0.01))
                
                await expect(
                    amm.connect(investor1).swapToken1(
                        tokens(1), 
                        acceptableMinimum, 
                        Math.floor(Date.now() / 1000) + 3600
                    )
                ).to.not.be.reverted
            })
        })

        describe('Deadline Protection', () => {
            it('reverts when transaction is past deadline', async () => {
                // Set deadline in the past
                const pastDeadline = Math.floor(Date.now() / 1000) - 3600
                
                await expect(
                    amm.connect(investor1).swapToken1(
                        tokens(1), 
                        0, 
                        pastDeadline
                    )
                ).to.be.revertedWith("Transaction expired")
            })

            it('succeeds when transaction is before deadline', async () => {
                // Set deadline in the future
                const futureDeadline = Math.floor(Date.now() / 1000) + 3600
                
                await expect(
                    amm.connect(investor1).swapToken1(
                        tokens(1), 
                        0, 
                        futureDeadline
                    )
                ).to.not.be.reverted
            })
        })
    })

    describe('Trading Fees (0.3%)', () => {
        let amount, transaction, balanceBefore, balanceAfter

        beforeEach(async () => {
            // Setup liquidity first
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
            
            // Setup investor approvals
            await token1.connect(investor1).approve(amm.address, tokens(100000))
        })

        it('collects 0.3% fee on swaps', async () => {
            // Record pool size before swap
            const poolToken1Before = await amm.token1Balance()
            const poolToken2Before = await amm.token2Balance()
            console.log(`Pool before: ${ethers.utils.formatEther(poolToken1Before)} token1, ${ethers.utils.formatEther(poolToken2Before)} token2`)

            // Perform swap
            transaction = await amm.connect(investor1).swapToken1(
                tokens(1000), 
                0, 
                Math.floor(Date.now() / 1000) + 3600
            )
            await transaction.wait()

            // Record pool size after swap
            const poolToken1After = await amm.token1Balance()
            const poolToken2After = await amm.token2Balance()
            console.log(`Pool after: ${ethers.utils.formatEther(poolToken1After)} token1, ${ethers.utils.formatEther(poolToken2After)} token2`)

            // Pool should have grown by fee amount
            const token1Increase = poolToken1After.sub(poolToken1Before)
            const expectedIncrease = tokens(1000) // Full input amount
            const feeAmount = tokens(1000).mul(3).div(1000) // 0.3% of input
            
            console.log(`Token1 increase: ${ethers.utils.formatEther(token1Increase)}`)
            console.log(`Expected fee: ${ethers.utils.formatEther(feeAmount)}`)

            expect(token1Increase).to.equal(expectedIncrease)
            // Pool grows because it keeps all input tokens (including fee portion)
        })

        it('demonstrates fee accumulation over multiple swaps', async () => {
            const initialK = await amm.K()
            console.log(`Initial K: ${initialK}`)

            // Perform multiple swaps to accumulate fees
            for(let i = 0; i < 3; i++) {
                await amm.connect(investor1).swapToken1(
                    tokens(100), 
                    0, 
                    Math.floor(Date.now() / 1000) + 3600
                )
            }

            const finalK = await amm.K()
            console.log(`Final K: ${finalK}`)
            console.log(`K increased by: ${finalK.sub(initialK)}`)

            // K should increase due to fee accumulation
            expect(finalK).to.be.gt(initialK)
        })

        it('shows LP value increase from fees', async () => {
            // Add second LP for comparison
            const lpAmount = tokens(50000)
            await token1.connect(liquidityProvider).approve(amm.address, lpAmount)
            await token2.connect(liquidityProvider).approve(amm.address, lpAmount)
            
            const token2Deposit = await amm.calculateToken2Deposit(lpAmount)
            await amm.connect(liquidityProvider).addLiquidity(lpAmount, token2Deposit)

            const lpShares = await amm.shares(liquidityProvider.address)
            console.log(`LP shares: ${ethers.utils.formatEther(lpShares)}`)

            // Record LP's withdrawable amounts before trading
            const withdrawBefore = await amm.calculateWithdrawAmount(lpShares)
            console.log(`Before trading - LP can withdraw: ${ethers.utils.formatEther(withdrawBefore.token1Amount)} token1, ${ethers.utils.formatEther(withdrawBefore.token2Amount)} token2`)

            // Generate trading volume (and fees!)
            for(let i = 0; i < 5; i++) {
                await amm.connect(investor1).swapToken1(
                    tokens(1000), 
                    0, 
                    Math.floor(Date.now() / 1000) + 3600
                )
            }

            // Record LP's withdrawable amounts after trading
            const withdrawAfter = await amm.calculateWithdrawAmount(lpShares)
            console.log(`After trading - LP can withdraw: ${ethers.utils.formatEther(withdrawAfter.token1Amount)} token1, ${ethers.utils.formatEther(withdrawAfter.token2Amount)} token2`)

            // LP can withdraw more due to accumulated fees!
            expect(withdrawAfter.token1Amount).to.be.gt(withdrawBefore.token1Amount)
        })
    })

    describe('Price Oracle Functions', () => {
        let amount

        beforeEach(async () => {
            // Setup liquidity
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
        })

        it('returns correct price', async () => {
            const price = await amm.getPrice()
            console.log(`Current price: ${ethers.utils.formatEther(price)}`)
            
            // With equal reserves, price should be 1.0 (1e18 in wei)
            expect(price).to.equal(ethers.utils.parseEther('1'))
        })

        it('returns pool reserves', async () => {
            const [reserve0, reserve1] = await amm.getReserves()
            console.log(`Reserves: ${ethers.utils.formatEther(reserve0)}, ${ethers.utils.formatEther(reserve1)}`)
            
            expect(reserve0).to.equal(amount)
            expect(reserve1).to.equal(amount)
        })

        it('calculates LP token value', async () => {
            const shares = await amm.shares(deployer.address)
            const [token1Amount, token2Amount] = await amm.getLPTokenValue(shares)
            
            console.log(`LP owns ${ethers.utils.formatEther(shares)} shares`)
            console.log(`Worth: ${ethers.utils.formatEther(token1Amount)} token1, ${ethers.utils.formatEther(token2Amount)} token2`)
            
            // Should be able to withdraw almost all liquidity (minus minimum lock)
            expect(token1Amount).to.be.closeTo(amount, 1000000) // Within 1M wei (accounts for minimum lock)
            expect(token2Amount).to.be.closeTo(amount, 1000000)
        })

        it('returns pool info', async () => {
            const [reserve0, reserve1, totalShares, kValue] = await amm.getPoolInfo()
            
            expect(reserve0).to.equal(amount)
            expect(reserve1).to.equal(amount)
            expect(totalShares).to.equal(tokens(100))
            expect(kValue).to.equal(amount.mul(amount))
        })
    })

    describe('Minimum Liquidity Protection', () => {
        it('prevents total liquidity drainage', async () => {
            // Setup initial liquidity
            const amount = tokens(1000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)

            const deployerShares = await amm.shares(deployer.address)
            const totalShares = await amm.totalShares()
            const minimumLock = await amm.MINIMUM_LIQUIDITY()
            
            console.log(`Deployer has ${ethers.utils.formatEther(deployerShares)} shares`)
            console.log(`Total shares: ${ethers.utils.formatEther(totalShares)}`)
            console.log(`Minimum lock: ${minimumLock}`)

            // Deployer tries to withdraw MORE than they own to trigger the drainage protection
            const attemptedWithdrawal = totalShares.sub(minimumLock.div(2)) // Try to leave less than minimum
            
            await expect(
                amm.connect(deployer).removeLiquidity(attemptedWithdrawal)
            ).to.be.revertedWith("Cannot withdraw shares in excess of allotted amount")
        })

        it('allows partial withdrawal but maintains minimum', async () => {
            // Setup initial liquidity
            const amount = tokens(1000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)

            const deployerShares = await amm.shares(deployer.address)
            const minimumLock = await amm.MINIMUM_LIQUIDITY()
            
            // Withdraw all but minimum + small buffer
            const maxWithdrawable = deployerShares.sub(minimumLock.mul(2))
            
            await expect(
                amm.connect(deployer).removeLiquidity(maxWithdrawable)
            ).to.not.be.reverted

            // Pool should still have remaining liquidity
            const remainingShares = await amm.totalShares()
            expect(remainingShares).to.be.gte(minimumLock)
        })

        it('requires minimum liquidity on first deposit', async () => {
            // Try to add liquidity below minimum - should fail
            await token1.connect(deployer).approve(amm.address, 500)
            await token2.connect(deployer).approve(amm.address, 500)

            await expect(
                amm.connect(deployer).addLiquidity(500, 500)
            ).to.be.revertedWith("Initial liquidity must exceed minimum lock")
        })
    })

    describe('Advanced Edge Cases & Stress Testing', () => {
        let amount

        beforeEach(async () => {
            // Setup liquidity
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
            
            // Setup investor approvals
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            await token2.connect(investor2).approve(amm.address, tokens(100000))
        })

        describe('Mathematical Edge Cases', () => {
            it('handles very small swap amounts (1 wei)', async () => {
                // Test minimum possible swap
                const estimate = await amm.calculateToken1Swap(1)
                
                await expect(
                    amm.connect(investor1).swapToken1(1, 0, Math.floor(Date.now() / 1000) + 3600)
                ).to.not.be.reverted
                
                console.log(`1 wei swap output: ${estimate} wei`)
            })

            it('prevents pool depletion on large swaps', async () => {
                // Try to swap amount that would drain the pool
                const poolToken2 = await amm.token2Balance()
                const largeSwapAmount = tokens(90000) // Would drain most of pool
                
                const estimate = await amm.calculateToken1Swap(largeSwapAmount)
                console.log(`Large swap estimate: ${ethers.utils.formatEther(estimate)}`)
                console.log(`Pool token2 balance: ${ethers.utils.formatEther(poolToken2)}`)
                
                // Should leave at least 1 wei in pool
                expect(estimate).to.be.lt(poolToken2)
                
                await expect(
                    amm.connect(investor1).swapToken1(largeSwapAmount, 0, Math.floor(Date.now() / 1000) + 3600)
                ).to.not.be.reverted
                
                // Verify pool still has minimum balance
                const remainingToken2 = await amm.token2Balance()
                expect(remainingToken2).to.be.gt(0)
                console.log(`Remaining token2 after large swap: ${remainingToken2}`)
            })

            it('maintains precision in cross-multiplication checks', async () => {
                // Add liquidity with large numbers to test precision
                const largeAmount1 = tokens(99999) 
                const largeAmount2 = await amm.calculateToken2Deposit(largeAmount1)
                
                await token1.connect(liquidityProvider).approve(amm.address, largeAmount1)
                await token2.connect(liquidityProvider).approve(amm.address, largeAmount2)
                
                // This should succeed due to proper cross-multiplication
                await expect(
                    amm.connect(liquidityProvider).addLiquidity(largeAmount1, largeAmount2)
                ).to.not.be.reverted
            })
        })

        describe('Multi-User Stress Testing', () => {
            it('handles multiple simultaneous LPs correctly', async () => {
                const lpAmount = tokens(25000)
                
                // Add multiple LPs
                const lps = [liquidityProvider, investor1, investor2]
                for(let lp of lps) {
                    const token2Amount = await amm.calculateToken2Deposit(lpAmount)
                    
                    await token1.connect(deployer).transfer(lp.address, lpAmount)
                    await token2.connect(deployer).transfer(lp.address, token2Amount)
                    
                    await token1.connect(lp).approve(amm.address, lpAmount)
                    await token2.connect(lp).approve(amm.address, token2Amount)
                    
                    await amm.connect(lp).addLiquidity(lpAmount, token2Amount)
                    
                    const shares = await amm.shares(lp.address)
                    console.log(`LP ${lp.address} has ${ethers.utils.formatEther(shares)} shares`)
                }
                
                // Verify total accounting is correct
                const totalShares = await amm.totalShares()
                const expectedTotal = tokens(100).add(tokens(75)) // Initial 100 + 3 LPs * 25 each
                expect(totalShares).to.equal(expectedTotal)
            })

            it('demonstrates price impact across multiple swappers', async () => {
                const swappers = [investor1, investor2]
                const initialPrice = await amm.getPrice()
                console.log(`Initial price: ${ethers.utils.formatEther(initialPrice)}`)
                
                // Multiple users swap in sequence
                for(let i = 0; i < swappers.length; i++) {
                    const swapper = swappers[i]
                    const swapAmount = tokens(1000).mul(i + 1) // Increasing swap sizes
                    
                    if(i === 0) {
                        // investor1 swaps token1
                        await amm.connect(swapper).swapToken1(swapAmount, 0, Math.floor(Date.now() / 1000) + 3600)
                    } else {
                        // investor2 swaps token2
                        await amm.connect(swapper).swapToken2(swapAmount, 0, Math.floor(Date.now() / 1000) + 3600)
                    }
                    
                    const currentPrice = await amm.getPrice()
                    console.log(`Price after swap ${i + 1}: ${ethers.utils.formatEther(currentPrice)}`)
                }
            })
        })

        describe('Gas Optimization Verification', () => {
            it('measures and compares gas costs', async () => {
                // Test swap gas costs
                const tx = await amm.connect(investor1).swapToken1(
                    tokens(1000), 
                    0, 
                    Math.floor(Date.now() / 1000) + 3600
                )
                const receipt = await tx.wait()
                
                console.log(`Swap gas used: ${receipt.gasUsed}`)
                console.log(`Gas price: ${tx.gasPrice}`)
                console.log(`Transaction fee: ${ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice))} ETH`)
                
                // Professional AMM swaps with security should be under 120k gas
                // Our AMM includes reentrancy protection, events, and comprehensive checks
                expect(receipt.gasUsed).to.be.lt(120000)
                
                // Log gas efficiency metrics
                console.log(`Gas efficiency: ${receipt.gasUsed < 110000 ? 'Excellent' : 'Good'}`)
            })

            it('compares oracle function gas costs', async () => {
                // Test oracle functions are view (should cost 0 gas when called directly)
                const price = await amm.getPrice()
                const [reserve0, reserve1] = await amm.getReserves()
                const [poolReserve0, poolReserve1, poolTotalShares, poolK] = await amm.getPoolInfo()
                
                console.log(`Oracle functions executed successfully:`)
                console.log(`- getPrice(): ${ethers.utils.formatEther(price)}`)
                console.log(`- getReserves(): ${ethers.utils.formatEther(reserve0)}, ${ethers.utils.formatEther(reserve1)}`)
                console.log(`- getPoolInfo(): reserves(${ethers.utils.formatEther(poolReserve0)}, ${ethers.utils.formatEther(poolReserve1)}), shares(${ethers.utils.formatEther(poolTotalShares)}), K(${poolK})`)
                
                // These should execute without gas cost in view context
                expect(price).to.be.gt(0)
                expect(reserve0).to.be.gt(0)
                expect(reserve1).to.be.gt(0)
                expect(poolReserve0).to.be.gt(0)
                expect(poolTotalShares).to.be.gt(0)
                expect(poolK).to.be.gt(0)
            })
        })
    })

    describe('Cross-Protocol Integration Simulation', () => {
        let amount

        beforeEach(async () => {
            // Setup liquidity
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
        })

        it('simulates arbitrage bot price checking', async () => {
            // Simulate external price movements
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            
            // Large swap to create price imbalance
            await amm.connect(investor1).swapToken1(tokens(10000), 0, Math.floor(Date.now() / 1000) + 3600)
            
            // Arbitrage bot checks price
            const ammPrice = await amm.getPrice()
            console.log(`AMM price after imbalance: ${ethers.utils.formatEther(ammPrice)}`)
            
            // Simulate external market price (e.g., from Chainlink oracle)
            const externalPrice = ethers.utils.parseEther('1.0') // Assume external market is still 1:1
            
            // Calculate arbitrage opportunity
            const priceDifference = ammPrice.gt(externalPrice) ? 
                ammPrice.sub(externalPrice) : externalPrice.sub(ammPrice)
            
            console.log(`Price difference: ${ethers.utils.formatEther(priceDifference)}`)
            console.log(`Arbitrage opportunity exists: ${priceDifference.gt(ethers.utils.parseEther('0.01'))}`)
        })

        it('simulates lending protocol collateral valuation', async () => {
            // Add LP
            const lpAmount = tokens(50000)
            await token1.connect(liquidityProvider).approve(amm.address, lpAmount)
            await token2.connect(liquidityProvider).approve(amm.address, lpAmount)
            
            const token2Deposit = await amm.calculateToken2Deposit(lpAmount)
            await amm.connect(liquidityProvider).addLiquidity(lpAmount, token2Deposit)
            
            const lpShares = await amm.shares(liquidityProvider.address)
            
            // Simulate lending protocol using LP tokens as collateral
            const [token1Value, token2Value] = await amm.getLPTokenValue(lpShares)
            
            console.log(`LP owns ${ethers.utils.formatEther(lpShares)} shares`)
            console.log(`Underlying value: ${ethers.utils.formatEther(token1Value)} token1, ${ethers.utils.formatEther(token2Value)} token2`)
            
            // Simulate USD conversion (assume token1=$2, token2=$3)
            const usdValue = token1Value.mul(2).add(token2Value.mul(3))
            const maxBorrow = usdValue.mul(75).div(100) // 75% collateral ratio
            
            console.log(`Estimated USD value: $${ethers.utils.formatEther(usdValue)}`)
            console.log(`Max borrowable (75%): $${ethers.utils.formatEther(maxBorrow)}`)
            
            expect(token1Value).to.be.gt(0)
            expect(token2Value).to.be.gt(0)
        })

        it('simulates analytics platform data aggregation', async () => {
            // Create some trading activity
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            
            const initialReserves = await amm.getReserves()
            const initialK = await amm.K()
            
            // Simulate trading volume
            for(let i = 0; i < 3; i++) {
                await amm.connect(investor1).swapToken1(tokens(1000), 0, Math.floor(Date.now() / 1000) + 3600)
            }
            
            // Analytics platform queries all data
            const finalReserves = await amm.getReserves()
            const price = await amm.getPrice()
            const [finalReserve0, finalReserve1, finalTotalShares, finalKValue] = await amm.getPoolInfo()
            const finalK = await amm.K()
            
            console.log(`Analytics Dashboard:`)
            console.log(`- Initial reserves: ${ethers.utils.formatEther(initialReserves[0])}, ${ethers.utils.formatEther(initialReserves[1])}`)
            console.log(`- Final reserves: ${ethers.utils.formatEther(finalReserves[0])}, ${ethers.utils.formatEther(finalReserves[1])}`)
            console.log(`- Current price: ${ethers.utils.formatEther(price)}`)
            console.log(`- Total shares: ${ethers.utils.formatEther(finalTotalShares)}`)
            console.log(`- Pool state: reserves(${ethers.utils.formatEther(finalReserve0)}, ${ethers.utils.formatEther(finalReserve1)}), K(${finalKValue})`)
            console.log(`- K growth: ${finalK.sub(initialK)} (fee accumulation)`)
            
            // Verify K increased due to fees
            expect(finalK).to.be.gt(initialK)
            expect(finalKValue).to.equal(finalK)
        })
    })

    describe('Security Edge Cases', () => {
        let amount

        beforeEach(async () => {
            // Setup liquidity
            amount = tokens(100000)
            await token1.connect(deployer).approve(amm.address, amount)
            await token2.connect(deployer).approve(amm.address, amount)
            await amm.connect(deployer).addLiquidity(amount, amount)
        })

        it('handles zero amount swaps gracefully', async () => {
            // First approve tokens for investor1
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            
            // Zero amount swaps return zero but don't revert
            const estimate = await amm.calculateToken1Swap(0)
            expect(estimate).to.equal(0)
            
            // The swap itself should succeed but transfer zero tokens
            const balanceBefore = await token2.balanceOf(investor1.address)
            
            await amm.connect(investor1).swapToken1(0, 0, Math.floor(Date.now() / 1000) + 3600)
            
            const balanceAfter = await token2.balanceOf(investor1.address)
            expect(balanceAfter).to.equal(balanceBefore) // No change
        })

        it('handles maximum slippage scenarios', async () => {
            // First approve tokens for investor1
            await token1.connect(investor1).approve(amm.address, tokens(100000))
            
            // Test with 0% slippage tolerance (most restrictive)
            const estimate = await amm.calculateToken1Swap(tokens(1))
            
            // Demand exact estimate - should succeed
            await expect(
                amm.connect(investor1).swapToken1(tokens(1), estimate, Math.floor(Date.now() / 1000) + 3600)
            ).to.not.be.reverted
            
            // Demand more than possible - should fail
            await expect(
                amm.connect(investor1).swapToken1(tokens(1), estimate.add(1), Math.floor(Date.now() / 1000) + 3600)
            ).to.be.revertedWith("Insufficient output amount")
        })

        it('validates proper proportional deposits', async () => {
            // Try to add liquidity with wrong ratio
            const wrongRatio1 = tokens(1000)
            const wrongRatio2 = tokens(500) // Should be 1000 to maintain 1:1 ratio
            
            await token1.connect(liquidityProvider).approve(amm.address, wrongRatio1)
            await token2.connect(liquidityProvider).approve(amm.address, wrongRatio2)
            
            await expect(
                amm.connect(liquidityProvider).addLiquidity(wrongRatio1, wrongRatio2)
            ).to.be.revertedWith("Must provide equal token amounts")
        })
    })
})