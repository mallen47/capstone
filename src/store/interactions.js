import { ethers } from "ethers"
import { setAccount, setProvider, setNetwork } from "./reducers/provider"
import { setContracts, setSymbols, balancesLoaded } from "./reducers/tokens"
import { setContract } from "./reducers/amm"
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

export const loadBalances = async (tokens, account, dispatch) => {
  const balance1 = await tokens[0].balanceOf(account)
  const balance2 = await tokens[1].balanceOf(account)

  dispatch(balancesLoaded(balance1, balance2))
}
