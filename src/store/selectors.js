import { createSelector } from "reselect"

const tokens = state => state.tokens.contracts
const swaps = state => state.amm.swaps

export const chartSelector = createSelector(swaps, tokens, (swaps, tokens) => {
  if (!tokens[0] || !tokens[1] || !swaps || swaps.length === 0) {
    return {
      series: [{
        name: "Rate",
        data: [],
        swaps: []
      }]
    }
  }

  // Filter by selected tokens
  swaps = swaps.filter(
    s =>
      s.args.tokenGet === tokens[0].address ||
      s.args.tokenGet === tokens[1].address
  )

  swaps = swaps.filter(
    s =>
      s.args.tokenGive === tokens[0].address ||
      s.args.tokenGive === tokens[1].address
  )

  // sort swaps by date ascending to compare history
  swaps = swaps.sort((a, b) => a.args.timestamp - b.args.timestamp)

  // we don't have the price natively, it must be calculated from the event
  swaps = swaps.map(s => decorateSwap(s))

  // Fetch prices
  const prices = swaps.map(s => s.rate)

  // sort by timestamp descending
  swaps = swaps.sort((a, b) => b.args.timestamp - a.args.timestamp)

  return {
    series: [
      {
        name: "Rate",
        data: prices,
        swaps: swaps,
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
