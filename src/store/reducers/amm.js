import { createSlice } from "@reduxjs/toolkit"

export const amm = createSlice({
  name: "amm",
  initialState: {
    contract: null,
    shares: 0,
    swaps: [],
    swapping: {
      isSwapping: false,
      isSuccess: false,
      transactionHash: null,
      errorMessage: null,
    },
    depositing: {
      isDepositing: false,
      isSuccess: false,
      transactionHash: null,
      errorMessage: null,
    },
    withdrawing: {
      isWithdrawing: false,
      isSuccess: false,
      transactionHash: null,
      errorMessage: null,
    },
  },
  reducers: {
    setContract: (state, action) => {
      state.contract = action.payload
    },
    sharesLoaded: (state, action) => {
      state.shares = action.payload
    },
    swapsLoaded: (state, action) => {
      state.swaps = action.payload
    },
    swapRequest: (state, action) => {
      state.swapping.isSwapping = true
      state.swapping.isSuccess = false
      state.swapping.transactionHash = null
      state.swapping.errorMessage = null
    },
    swapSuccess: (state, action) => {
      state.swapping.isSwapping = false
      state.swapping.isSuccess = true
      state.swapping.transactionHash = action.payload
    },
    swapFail: (state, action) => {
      state.swapping.isSwapping = false
      state.swapping.isSuccess = false
      state.swapping.transactionHash = null
      state.swapping.errorMessage = action.payload
    },
    depositRequest: (state, action) => {
      state.depositing.isDepositing = true
      state.depositing.isSuccess = false
      state.depositing.transactionHash = null
      state.depositing.errorMessage = null
    },
    depositSuccess: (state, action) => {
      state.depositing.isDepositing = false
      state.depositing.isSuccess = true
      state.depositing.transactionHash = action.payload
    },
    depositFail: (state, action) => {
      state.depositing.isDepositing = false
      state.depositing.isSuccess = false
      state.depositing.transactionHash = null
      state.depositing.errorMessage = action.payload
    },
    withdrawRequest: (state, action) => {
      state.withdrawing.isWithdrawing = true
      state.withdrawing.isSuccess = false
      state.withdrawing.transactionHash = null
      state.withdrawing.errorMessage = null
    },
    withdrawSuccess: (state, action) => {
      state.withdrawing.isWithdrawing = false
      state.withdrawing.isSuccess = true
      state.withdrawing.transactionHash = action.payload
    },
    withdrawFail: (state, action) => {
      state.withdrawing.isWithdrawing = false
      state.withdrawing.isSuccess = false
      state.withdrawing.transactionHash = null
      state.withdrawing.errorMessage = action.payload
    },
    swapReset: (state, action) => {
      state.swapping.isSuccess = false
      state.swapping.transactionHash = null
      state.swapping.errorMessage = null
    },
    depositReset: (state, action) => {
      state.depositing.isSuccess = false
      state.depositing.transactionHash = null
      state.depositing.errorMessage = null
    },
    withdrawReset: (state, action) => {
      state.withdrawing.isSuccess = false
      state.withdrawing.transactionHash = null
      state.withdrawing.errorMessage = null
    },
  },
})

export const {
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
  swapReset,
  depositReset,
  withdrawReset,
} = amm.actions
export default amm.reducer
