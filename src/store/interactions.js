import { ethers } from "ethers"
import { setAccount, setProvider, setNetwork } from "./reducers/provider"
import { setContracts, setSymbols, balancesLoaded } from "./reducers/tokens"
import {
  setContract,
  sharesLoaded,
  swapRequest,
  swapSuccess,
  swapFail,
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
    dispatch(swapFail())
  }
}
