import { ethers } from "ethers"
import { setAccount, setProvider, setNetwork } from "./reducers/provider"
import { setContracts, setSymbols, balancesLoaded } from "./reducers/tokens"
import {
  setContract,
  sharesLoaded,
  swapsLoaded,
  swapRequest,
  swapSuccess,
  swapFail,
  depositRequest,
  depositSuccess,
  depositFail,
  withdrawRequest,
  withdrawSuccess,
  withdrawFail,
} from "./reducers/amm"
import TOKEN_ABI from "../abis/Token.json"
import AMM_ABI from "../abis/AMM.json"
import config from "../config.json"

export const loadProvider = async dispatch => {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  dispatch(setProvider(provider))

  return provider
}

export const loadNetwork = async (provider, dispatch) => {
  const { chainId } = await provider.getNetwork()
  dispatch(setNetwork(chainId))

  return chainId
}

export const loadAccount = async dispatch => {
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  })
  const account = accounts[0]
  dispatch(setAccount(account))

  return account
}

// ------------------------
// Load Contracts

export const loadTokens = async (provider, chainId, dispatch) => {
  const dappCoin = new ethers.Contract(
    config[chainId].dappCoin.address,
    TOKEN_ABI,
    provider
  )
  const usdk = new ethers.Contract(
    config[chainId].usdk.address,
    TOKEN_ABI,
    provider
  )

  dispatch(setContracts([dappCoin, usdk]))
  dispatch(setSymbols([await dappCoin.symbol(), await usdk.symbol()]))
}

export const loadAMM = async (provider, chainId, dispatch) => {
  const amm = new ethers.Contract(
    config[chainId].amm.address,
    AMM_ABI,
    provider
  )

  dispatch(setContract(amm))

  return amm
}

//--------------------------
// Load Balances and Shares

export const loadBalances = async (amm, tokens, account, dispatch) => {
  const balance1 = await tokens[0].balanceOf(account)
  const balance2 = await tokens[1].balanceOf(account)

  dispatch(
    balancesLoaded([
      ethers.utils.formatUnits(balance1.toString(), "ether"),
      ethers.utils.formatUnits(balance2.toString(), "ether"),
    ])
  )

  const shares = await amm.shares(account)
  dispatch(sharesLoaded(ethers.utils.formatUnits(shares.toString(), "ether")))
}

////////////////////////////////////
// Helper function to parse MetaMask error messages
const parseErrorMessage = error => {
  if (error.code === 4001) {
    return "Transaction rejected by user"
  }

  if (error.code === -32603) {
    return "Internal error - please try again"
  }

  // Check for specific error messages in the error string
  const errorString = error.message || error.toString()

  if (errorString.includes("user rejected transaction")) {
    return "Transaction rejected by user"
  }

  if (errorString.includes("insufficient funds")) {
    return "Insufficient funds for transaction"
  }

  if (errorString.includes("gas required exceeds allowance")) {
    return "Gas limit too low"
  }

  if (errorString.includes("execution reverted")) {
    return "Transaction reverted - check token allowance"
  }

  if (errorString.includes("network changed")) {
    return "Network changed during transaction"
  }

  // Default fallback for unknown errors
  return "Transaction failed - please try again"
}

////////////////////////////////////
// Swap tokens

export const swap = async (provider, amm, token, symbol, amount, dispatch) => {
  try {
    dispatch(swapRequest())

    let transaction

    const signer = await provider.getSigner()

    transaction = await token.connect(signer).approve(amm.address, amount)
    await transaction.wait()

    // Set deadline (1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600

    if (symbol === "DPC") {
      // For DPC -> USDK swap, set minimum tokens to 0 (no slippage protection for now)
      transaction = await amm.connect(signer).swapToken1(amount, 0, deadline)
    } else {
      // For USDK -> DPC swap, set minimum tokens to 0 (no slippage protection for now)
      transaction = await amm.connect(signer).swapToken2(amount, 0, deadline)
    }
    await transaction.wait()

    dispatch(swapSuccess(transaction.hash))
  } catch (error) {
    console.error("Swap error:", error)
    const errorMessage = parseErrorMessage(error)
    dispatch(swapFail(errorMessage))
  }
}

/////////////////////////////////
// Add Liquidity

export const addLiquidity = async (
  provider,
  amm,
  tokens,
  amounts,
  dispatch
) => {
  try {
    dispatch(depositRequest())

    const signer = await provider.getSigner()

    let transaction

    transaction = await tokens[0]
      .connect(signer)
      .approve(amm.address, amounts[0])
    await transaction.wait()

    transaction = await tokens[1]
      .connect(signer)
      .approve(amm.address, amounts[1])
    await transaction.wait()

    transaction = await amm.connect(signer).addLiquidity(amounts[0], amounts[1])
    await transaction.wait()

    dispatch(depositSuccess(transaction.hash))
  } catch (error) {
    console.log("Deposit error:", error)
    const errorMessage = parseErrorMessage(error)
    dispatch(depositFail(errorMessage))
  }
}

///////////////////////////
// Remove liquidity

export const removeLiquidity = async (provider, amm, shares, dispatch) => {
  try {
    dispatch(withdrawRequest())

    const signer = await provider.getSigner()

    let transaction = await amm.connect(signer).removeLiquidity(shares)
    await transaction.wait()

    dispatch(withdrawSuccess(transaction.hash))
  } catch (error) {
    console.log("Deposit error:", error)
    const errorMessage = parseErrorMessage(error)
    dispatch(withdrawFail(errorMessage))
  }
}

//////////////////////////////
// Load all swaps

export const loadAllSwaps = async (provider, amm, dispatch) => {
  // Fetch swaps from Blockchain
  const block = await provider.getBlockNumber()
  const swapStream = await amm.queryFilter("Swap", 0, block)
  const swaps = swapStream.map(event => {
    return { hash: event.transactionHash, args: event.args }
  })

  dispatch(swapsLoaded(swaps))
}
