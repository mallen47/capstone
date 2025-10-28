import { ethers } from "ethers"
import { useState, useEffect, useCallback } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import Col from "react-bootstrap/Col"
import InputGroup from "react-bootstrap/InputGroup"
import Spinner from "react-bootstrap/Spinner"
import Button from "react-bootstrap/Button"
import OverlayTrigger from "react-bootstrap/OverlayTrigger"
import Tooltip from "react-bootstrap/Tooltip"
import { removeLiquidity, loadBalances } from "../store/interactions"
import { withdrawReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Withdraw = () => {
  const [amount, setAmount] = useState(0)
  const [lpTokenValue, setLpTokenValue] = useState(null)
  const [poolInfo, setPoolInfo] = useState(null)
  const [estimatedValue, setEstimatedValue] = useState(null)
  const [impermanentLoss, setImpermanentLoss] = useState(null)
  const [yieldMetrics, setYieldMetrics] = useState(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [showLPValue, setShowLPValue] = useState(false)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const balances = useSelector(state => state.tokens.balances)
  const shares = useSelector(state => state.amm.shares)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const amm = useSelector(state => state.amm.contract)
  const isWithdrawing = useSelector(
    state => state.amm.withdrawing.isWithdrawing
  )
  const isSuccess = useSelector(state => state.amm.withdrawing.isSuccess)
  const transactionHash = useSelector(
    state => state.amm.withdrawing.transactionHash
  )
  const errorMessage = useSelector(state => state.amm.withdrawing.errorMessage)

  const dispatch = useDispatch()

  // Load LP token analytics
  const loadLPAnalytics = useCallback(async () => {
    if (!amm || !shares || parseFloat(shares) === 0) {
      setLpTokenValue(null)
      setPoolInfo(null)
      setEstimatedValue(null)
      return
    }

    try {
      setIsLoadingAnalytics(true)

      // Get user's LP token value
      const _shares = ethers.utils.parseUnits(shares.toString(), "ether")
      const lpValue = await amm.getLPTokenValue(_shares)

      // Get pool info
      const poolData = await amm.getPoolInfo()

      // Get current price (USDK per DPC)
      const price = await amm.getPrice()

      const token1Amount = parseFloat(
        ethers.utils.formatEther(lpValue.token1Amount)
      )
      const token2Amount = parseFloat(
        ethers.utils.formatEther(lpValue.token2Amount)
      )
      const priceFormatted = parseFloat(ethers.utils.formatEther(price))

      setLpTokenValue({
        token1: token1Amount,
        token2: token2Amount,
      })

      const totalShares = parseFloat(
        ethers.utils.formatEther(poolData.totalShares_)
      )
      const userShares = parseFloat(shares)
      const ownershipPercent =
        totalShares > 0 ? (userShares / totalShares) * 100 : 0

      const reserve1 = parseFloat(ethers.utils.formatEther(poolData.reserve0))
      const reserve2 = parseFloat(ethers.utils.formatEther(poolData.reserve1))

      setPoolInfo({
        totalShares: totalShares,
        ownershipPercent: ownershipPercent,
        reserve1: reserve1,
        reserve2: reserve2,
      })

      // Calculate estimated USD value (using token2 as base)
      const estimatedUSD = token2Amount + token1Amount * priceFormatted
      setEstimatedValue(estimatedUSD)

      // Calculate Impermanent Loss
      // For educational purposes, we'll use a simplified approach:
      // Compare current LP value vs. if user had just held tokens
      // IL occurs when price changes - we'll calculate based on current vs initial price

      // Get initial pool ratio (we'll use a 1:1 baseline for educational purposes)
      // In a production app, you'd track actual deposit prices via events
      const initialPrice = 1 // Baseline: assume 1:1 initial ratio for educational calc
      const currentPrice = priceFormatted

      if (currentPrice > 0 && initialPrice > 0) {
        // Calculate what tokens user would have if they deposited at 1:1 ratio
        // At deposit: user provided equal USD value of both tokens
        // Current LP position: token1Amount of token1 + token2Amount of token2

        // Working backwards: if current LP has token1Amount and token2Amount,
        // and constant product k = token1 * token2 is maintained,
        // at initial 1:1 price, user would have deposited:
        // initialToken1 = sqrt(k / initialPrice) and initialToken2 = sqrt(k * initialPrice)

        const k = token1Amount * token2Amount
        const initialToken1 = Math.sqrt(k / initialPrice)
        const initialToken2 = Math.sqrt(k * initialPrice)

        // HODL value: what those initial tokens are worth now at current price
        const hodlValue = initialToken1 * currentPrice + initialToken2

        // IL percentage: (LP Value - HODL Value) / HODL Value * 100
        const ilPercentage =
          hodlValue > 0 ? ((estimatedUSD - hodlValue) / hodlValue) * 100 : 0

        setImpermanentLoss({
          percentage: ilPercentage,
          hodlValue: hodlValue,
          lpValue: estimatedUSD,
          difference: estimatedUSD - hodlValue,
        })
      } else {
        setImpermanentLoss(null)
      }

      // Calculate Yield Farming Metrics
      // For educational purposes: estimate trading fee earnings based on pool activity
      // In production, you'd track actual fee earnings via events

      // Get pool reserves in USD terms
      const reserve1USD = reserve1 * priceFormatted
      const reserve2USD = reserve2
      const totalPoolUSD = reserve1USD + reserve2USD

      // Simulate daily volume as 10% of total pool USD value (educational estimate)
      const dailyVolume = totalPoolUSD * 0.1

      // 0.3% trading fee on volume
      const dailyFees = dailyVolume * 0.003

      // User's share of fees based on pool ownership
      const dailyUserFees = dailyFees * (ownershipPercent / 100)

      // Annualized metrics
      const yearlyUserFees = dailyUserFees * 365
      const apr = estimatedUSD > 0 ? (yearlyUserFees / estimatedUSD) * 100 : 0

      // APY with daily compounding: (1 + daily_rate)^365 - 1
      const dailyRate = estimatedUSD > 0 ? dailyUserFees / estimatedUSD : 0
      const apy = dailyRate > 0 ? (Math.pow(1 + dailyRate, 365) - 1) * 100 : 0

      setYieldMetrics({
        estimatedDailyFees: dailyUserFees,
        estimatedYearlyFees: yearlyUserFees,
        apr: apr,
        apy: apy,
      })
    } catch (error) {
      console.error("Error loading LP analytics:", error)
      setLpTokenValue(null)
      setPoolInfo(null)
      setEstimatedValue(null)
      setImpermanentLoss(null)
      setYieldMetrics(null)
    } finally {
      setIsLoadingAnalytics(false)
    }
  }, [amm, shares])

  // Load analytics on mount and when shares change
  useEffect(() => {
    loadLPAnalytics()
  }, [loadLPAnalytics])

  useEffect(() => {
    if (isWithdrawing) {
      showToast("info", "Withdraw Pending...")
    }
  }, [isWithdrawing])

  useEffect(() => {
    if (isSuccess && transactionHash) {
      showToast("success", "Withdraw Successful!", transactionHash)
      // Reload balances after successful withdraw
      loadBalances(amm, tokens, account, dispatch)
      // Reload analytics after successful withdraw
      loadLPAnalytics()
      // Clear input field after successful transaction
      setAmount(0)
      // Reset the success state to prevent duplicate toasts
      dispatch(withdrawReset())
    }
  }, [
    isSuccess,
    transactionHash,
    amm,
    tokens,
    account,
    dispatch,
    loadLPAnalytics,
  ])

  useEffect(() => {
    if (!isSuccess && !isWithdrawing && errorMessage) {
      showToast("danger", errorMessage)
      dispatch(withdrawReset())
    }
  }, [isSuccess, isWithdrawing, errorMessage, dispatch])

  // Max button handler
  const setMaxShares = () => {
    if (shares) {
      setAmount(shares)
    }
  }

  const withdrawHandler = async e => {
    e.preventDefault()

    if (!amm || !provider) {
      showToast(
        "warning",
        "Contracts not loaded yet. Please wait and try again."
      )
      return
    }

    if (!amount || amount === "" || amount === "0") {
      showToast("warning", "Please enter an amount to withdraw.")
      return
    }

    if (parseFloat(amount) <= 0) {
      showToast("warning", "Please enter a share amount greater than zero")
      return
    }

    if (!shares || parseFloat(shares) === 0) {
      showToast("warning", "Sorry, you have no shares available to withdraw")
      return
    }

    if (parseFloat(amount) > parseFloat(shares)) {
      showToast("warning", "Cannot withdraw more shares than you have")
      return
    }

    const _shares = ethers.utils.parseUnits(amount.toString(), "ether")
    await removeLiquidity(provider, amm, _shares, dispatch)
    return
  }

  return (
    <div>
      <Card style={{ maxWidth: "450px" }} className="mx-auto px-4">
        {account ? (
          <Form
            onSubmit={withdrawHandler}
            style={{ maxWidth: "450px", margin: "50px auto" }}
          >
            {/* LP Portfolio Analytics */}
            {shares && parseFloat(shares) > 0 && (
              <Row className="mt-4 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-muted">
                    <strong>LP Position:</strong>{" "}
                    {isLoadingAnalytics ? (
                      <Spinner animation="border" size="sm" />
                    ) : lpTokenValue && poolInfo ? (
                      <>
                        {parseFloat(shares).toFixed(2)} shares (
                        {poolInfo.ownershipPercent.toFixed(2)}%)
                      </>
                    ) : (
                      "Loading..."
                    )}
                  </small>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setShowLPValue(!showLPValue)}
                    className="d-flex align-items-center gap-1 py-1 px-2"
                    style={{ fontSize: "0.813rem" }}
                  >
                    <i className="bi bi-info-circle"></i>
                    <span>{showLPValue ? "Hide" : "Details"}</span>
                  </Button>
                </div>

                {showLPValue &&
                  lpTokenValue &&
                  poolInfo &&
                  !isLoadingAnalytics && (
                    <div className="border rounded my-2 p-3 mb-2 bg-light">
                      {/* LP Token Value Section */}
                      <Form.Label className="small">
                        <strong>LP Token Value</strong>
                      </Form.Label>
                      <Row className="mb-2">
                        <Col xs={6}>{symbols[0]}:</Col>
                        <Col xs={6} className="text-end">
                          {lpTokenValue.token1.toFixed(6)}
                        </Col>
                      </Row>
                      <Row className="mb-2">
                        <Col xs={6}>{symbols[1]}:</Col>
                        <Col xs={6} className="text-end">
                          {lpTokenValue.token2.toFixed(6)}
                        </Col>
                      </Row>
                      {estimatedValue && (
                        <Row className="mb-2">
                          <Col xs={6}>
                            <strong>Est. Value:</strong>
                          </Col>
                          <Col xs={6} className="text-end">
                            <strong>~${estimatedValue.toFixed(2)}</strong>
                          </Col>
                        </Row>
                      )}

                      {/* Impermanent Loss Section */}
                      {impermanentLoss && (
                        <>
                          <hr className="my-3" />
                          <Form.Label className="small">
                            <strong>Impermanent Loss Analysis</strong>
                          </Form.Label>
                          <Row className="mb-2">
                            <Col xs={6}>
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip>
                                    The percentage difference between providing
                                    liquidity vs. simply holding your tokens.
                                    Negative = loss from providing liquidity.
                                  </Tooltip>
                                }
                              >
                                <span style={{ cursor: "help" }}>
                                  IL Impact:
                                </span>
                              </OverlayTrigger>
                            </Col>
                            <Col xs={6} className="text-end">
                              <span
                                style={{
                                  color:
                                    impermanentLoss.percentage < 0
                                      ? "#dc3545"
                                      : "#28a745",
                                }}
                              >
                                {impermanentLoss.percentage.toFixed(2)}%
                              </span>
                            </Col>
                          </Row>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <small className="text-muted">LP Value:</small>
                            </Col>
                            <Col xs={5} className="text-end">
                              <small>
                                ${impermanentLoss.lpValue.toFixed(2)}
                              </small>
                            </Col>
                          </Row>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <small className="text-muted">HODL Value:</small>
                            </Col>
                            <Col xs={5} className="text-end">
                              <small>
                                ${impermanentLoss.hodlValue.toFixed(2)}
                              </small>
                            </Col>
                          </Row>
                        </>
                      )}

                      {/* Yield Farming Metrics Section */}
                      {yieldMetrics && (
                        <>
                          <hr className="my-3" />
                          <Form.Label className="small">
                            <strong>Yield Farming Metrics</strong>
                          </Form.Label>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip>
                                    Annual Percentage Rate: Simple interest
                                    earned from trading fees over one year
                                    without compounding.
                                  </Tooltip>
                                }
                              >
                                <strong style={{ cursor: "help" }}>APR:</strong>
                              </OverlayTrigger>
                            </Col>
                            <Col xs={5} className="text-end">
                              <strong style={{ color: "#28a745" }}>
                                {yieldMetrics.apr.toFixed(2)}%
                              </strong>
                            </Col>
                          </Row>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip>
                                    Annual Percentage Yield: Interest earned
                                    with daily compounding (reinvesting fees).
                                    Always higher than APR.
                                  </Tooltip>
                                }
                              >
                                <strong style={{ cursor: "help" }}>APY:</strong>
                              </OverlayTrigger>
                            </Col>
                            <Col xs={5} className="text-end">
                              <strong style={{ color: "#28a745" }}>
                                {yieldMetrics.apy.toFixed(2)}%
                              </strong>
                            </Col>
                          </Row>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <small className="text-muted">
                                Est. Daily Fees:
                              </small>
                            </Col>
                            <Col xs={5} className="text-end">
                              <small>
                                ${yieldMetrics.estimatedDailyFees.toFixed(4)}
                              </small>
                            </Col>
                          </Row>
                          <Row className="mb-2">
                            <Col xs={7}>
                              <small className="text-muted">
                                Est. Yearly Fees:
                              </small>
                            </Col>
                            <Col xs={5} className="text-end">
                              <small>
                                ${yieldMetrics.estimatedYearlyFees.toFixed(2)}
                              </small>
                            </Col>
                          </Row>
                          <Form.Text className="text-muted small">
                            * Estimates based on 0.3% trading fee and simulated
                            volume
                          </Form.Text>
                        </>
                      )}
                    </div>
                  )}
              </Row>
            )}

            <Row>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Text muted>Shares: {shares}</Form.Text>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={setMaxShares}
                  disabled={!shares || parseFloat(shares) === 0}
                >
                  Max
                </Button>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0"
                  min="0.0"
                  step="any"
                  id="shares"
                  value={amount === 0 ? "" : amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <InputGroup.Text
                  style={{ width: "100px" }}
                  className="justify-content-center"
                >
                  Shares
                </InputGroup.Text>
              </InputGroup>
            </Row>

            <div className="my-4">
              {isWithdrawing ? (
                <Spinner
                  animation="border"
                  style={{ display: "block", margin: "0 auto" }}
                />
              ) : (
                <Button type="submit" className="w-100">
                  Withdraw
                </Button>
              )}
            </div>
            <hr />
            <Row>
              <p>
                <strong>DPC Balance:</strong> {balances[0]}
              </p>
              <p>
                <strong>USDK Balance:</strong> {balances[1]}
              </p>
            </Row>
          </Form>
        ) : (
          <p
            className="d-flex justify-content-center align-items-center"
            style={{ height: "300px" }}
          >
            Please connect wallet.
          </p>
        )}
      </Card>
    </div>
  )
}

export default Withdraw
