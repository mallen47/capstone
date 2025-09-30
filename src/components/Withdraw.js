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
import Badge from "react-bootstrap/Badge"
import Alert from "react-bootstrap/Alert"
import { removeLiquidity, loadBalances } from "../store/interactions"
import { withdrawReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Withdraw = () => {
  const [amount, setAmount] = useState(0)
  const [lpTokenValue, setLpTokenValue] = useState(null)
  const [poolInfo, setPoolInfo] = useState(null)
  const [estimatedValue, setEstimatedValue] = useState(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)

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

      setPoolInfo({
        totalShares: totalShares,
        ownershipPercent: ownershipPercent,
        reserve1: parseFloat(ethers.utils.formatEther(poolData.reserve0)),
        reserve2: parseFloat(ethers.utils.formatEther(poolData.reserve1)),
      })

      // Calculate estimated USD value (using token2 as base)
      const estimatedUSD = token2Amount + token1Amount * priceFormatted
      setEstimatedValue(estimatedUSD)
    } catch (error) {
      console.error("Error loading LP analytics:", error)
      setLpTokenValue(null)
      setPoolInfo(null)
      setEstimatedValue(null)
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
              <Alert variant="info" className="mb-3">
                <Alert.Heading className="h6">Your LP Position</Alert.Heading>
                {isLoadingAnalytics ? (
                  <div className="text-center">
                    <Spinner animation="border" size="sm" />
                  </div>
                ) : lpTokenValue && poolInfo ? (
                  <>
                    <Row className="mb-2">
                      <Col xs={6}>
                        <strong>Your Shares:</strong>
                      </Col>
                      <Col xs={6} className="text-end">
                        {parseFloat(shares).toFixed(4)}
                      </Col>
                    </Row>
                    <Row className="mb-2">
                      <Col xs={6}>
                        <strong>Pool Ownership:</strong>
                      </Col>
                      <Col xs={6} className="text-end">
                        {poolInfo.ownershipPercent.toFixed(4)}%
                      </Col>
                    </Row>
                    <hr />
                    <div className="mb-2 text-center">
                      <Badge bg="secondary">LP Token Value</Badge>
                    </div>
                    <Row className="mb-1">
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
                  </>
                ) : null}
              </Alert>
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

            <Row className="my-4">
              {isWithdrawing ? (
                <Spinner
                  animation="border"
                  style={{ display: "block", margin: "0 auto" }}
                />
              ) : (
                <Button type="submit">Withdraw</Button>
              )}
            </Row>
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
