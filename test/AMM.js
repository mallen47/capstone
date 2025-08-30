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

          // Check deployer receives 100 shares upon inital deposit into pool
          expect(await amm.shares(deployer.address)).to.equal(tokens(100))

          // Check pool now has 100 shares
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

          // Deployer should still have 100 shares
          expect(await amm.shares(deployer.address)).to.equal(tokens(100));

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

          await expect(transaction).to.emit(amm, 'liquidityRemoved')
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

          // Deployer should have 100 shares
          expect(await amm.shares(deployer.address)).to.equal(shares(100))

          // AMM pool has 100 total shares
          expect(await amm.totalShares()).to.equal(shares(100))

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
})