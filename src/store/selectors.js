import { createSelector } from "reselect"

const tokens = state => state.tokens.contracts
const swaps = state => state.amm.swaps

export const chartSelector = createSelector(swaps, tokens, (allTransactions, tokens) => {
  if (!tokens[0] || !tokens[1] || !allTransactions || allTransactions.length === 0) {
    return {
      series: [{
        name: "Rate",
        data: [],
        swaps: []
      }]
    }
  }

  // Separate swaps from other transactions for the price chart
  const onlySwaps = allTransactions.filter(t => t.type === "Swap")

  // Filter swaps by selected tokens for price chart
  let filteredSwaps = onlySwaps.filter(
    s =>
      s.args.tokenGet === tokens[0].address ||
      s.args.tokenGet === tokens[1].address
  )

  filteredSwaps = filteredSwaps.filter(
    s =>
      s.args.tokenGive === tokens[0].address ||
      s.args.tokenGive === tokens[1].address
  )

  // sort swaps by date ascending to compare history
  filteredSwaps = filteredSwaps.sort((a, b) => a.args.timestamp - b.args.timestamp)

  // we don't have the price natively, it must be calculated from the event
  filteredSwaps = filteredSwaps.map(s => decorateSwap(s))

  // Fetch prices for chart
  const prices = filteredSwaps.map(s => s.rate)

  // Return all transactions (swaps, deposits, withdrawals) for the table
  // Already sorted by timestamp descending from interactions.js
  return {
    series: [
      {
        name: "Rate",
        data: prices,
        swaps: allTransactions, // Return ALL transactions, not just swaps
      },
    ],
  }
})

const decorateSwap = swap => {
  const precision = 100000
  let rate = swap.args.token2Balance / swap.args.token1Balance

  rate = Math.round(rate * precision) / precision

  return {
    ...swap,
    rate,
  }
}
