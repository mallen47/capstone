import { ethers } from "ethers"
import { useState, useEffect, useCallback } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import InputGroup from "react-bootstrap/InputGroup"
import Dropdown from "react-bootstrap/Dropdown"
import DropdownButton from "react-bootstrap/DropdownButton"
import Button from "react-bootstrap/Button"
import Row from "react-bootstrap/Row"
import Spinner from "react-bootstrap/Spinner"
import Badge from "react-bootstrap/Badge"
import { swap, loadBalances } from "../store/interactions"
import { swapReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Swap = () => {
  const [inputToken, setInputToken] = useState(null)
  const [outputToken, setOutputToken] = useState(null)
  const [inputAmount, setInputAmount] = useState(0)
  const [outputAmount, setOutputAmount] = useState(0)
  const [price, setPrice] = useState(0)
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [priceImpact, setPriceImpact] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [deadlineMinutes, setDeadlineMinutes] = useState(20)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)
  const amm = useSelector(state => state.amm.contract)
  const isSwapping = useSelector(state => state.amm.swapping.isSwapping)
  const isSuccess = useSelector(state => state.amm.swapping.isSuccess)
  const transactionHash = useSelector(
    state => state.amm.swapping.transactionHash
  )
  const errorMessage = useSelector(state => state.amm.swapping.errorMessage)

  const dispatch = useDispatch()

  // Calculate price impact
  const calculatePriceImpact = async (
    inputValue,
    outputValue,
    inputTokenSymbol
  ) => {
    try {
      if (!inputValue || !outputValue || !amm) {
        setPriceImpact(0)
        return
      }

      const [token1Bal, token2Bal] = await Promise.all([
        amm.token1Balance(),
        amm.token2Balance(),
      ])

      const dpcBalance = parseFloat(ethers.utils.formatEther(token1Bal))
      const usdkBalance = parseFloat(ethers.utils.formatEther(token2Bal))

      // Current price before trade
      const currentPrice =
        inputTokenSymbol === "DPC"
          ? usdkBalance / dpcBalance
          : dpcBalance / usdkBalance

      // Effective price after trade
      const effectivePrice = parseFloat(outputValue) / parseFloat(inputValue)

      // Price impact = (effective price - current price) / current price * 100
      const impact =
        Math.abs((effectivePrice - currentPrice) / currentPrice) * 100
      setPriceImpact(impact)
    } catch (error) {
      console.error("Error calculating price impact:", error)
      setPriceImpact(0)
    }
  }

  // Calculate minimum output amount with slippage tolerance
  const calculateMinimumOutput = (outputAmount, slippage) => {
    if (!outputAmount || outputAmount === 0) return "0"
    const minOutput = parseFloat(outputAmount) * (1 - slippage / 100)
    return minOutput.toFixed(6)
  }

  const inputHandler = async e => {
    if (!inputToken || !outputToken) {
      showToast("warning", "Please select a token")
      return
    }

    if (inputToken === outputToken) {
      showToast("warning", "Invalid token pair")
      return
    }

    const inputValue = e.target.value
    setInputAmount(inputValue)

    // Handle empty or invalid input values
    if (
      !inputValue ||
      inputValue === "" ||
      isNaN(inputValue) ||
      parseFloat(inputValue) <= 0
    ) {
      setOutputAmount(0)
      return
    }

    try {
      if (inputToken === "DPC") {
        const result = await amm.calculateToken1Swap(
          ethers.utils.parseUnits(inputValue, "ether")
        )
        const _token2Amount = ethers.utils.formatUnits(
          result.toString(),
          "ether"
        )
        setOutputAmount(_token2Amount.toString())
        // Calculate price impact
        calculatePriceImpact(inputValue, _token2Amount, "DPC")
      } else {
        const result = await amm.calculateToken2Swap(
          ethers.utils.parseUnits(inputValue, "ether")
        )
        const _token1Amount = ethers.utils.formatUnits(
          result.toString(),
          "ether"
        )
        setOutputAmount(_token1Amount.toString())
        // Calculate price impact
        calculatePriceImpact(inputValue, _token1Amount, "USDK")
      }
    } catch (error) {
      console.error("Error calculating swap amount:", error)
      setOutputAmount(0)
    }
  }

  const swapHandler = async e => {
    e.preventDefault()

    if (inputToken === outputToken) {
      showToast("warning", "Invalid token pair")
      return
    }

    if (!tokens || tokens.length < 2) {
      showToast("warning", "Tokens not loaded yet. Please wait and try again.")
      return
    }

    if (!inputAmount || inputAmount === 0 || inputAmount === "0") {
      showToast("warning", "Please enter an amount to swap")
      return
    }

    const _inputAmount = ethers.utils.parseUnits(
      inputAmount.toString(),
      "ether"
    )

    // Calculate minimum output with slippage protection
    const minimumOutput = calculateMinimumOutput(
      outputAmount,
      slippageTolerance
    )
    const _minimumOutput = ethers.utils.parseUnits(minimumOutput, "ether")

    if (inputToken === "DPC") {
      await swap(
        provider,
        amm,
        tokens[0],
        inputToken,
        _inputAmount,
        _minimumOutput,
        deadlineMinutes,
        dispatch
      )
    } else {
      await swap(
        provider,
        amm,
        tokens[1],
        inputToken,
        _inputAmount,
        _minimumOutput,
        deadlineMinutes,
        dispatch
      )
    }
  }

  const getPrice = useCallback(async () => {
    // Early returns for invalid states
    if (!inputToken || !outputToken || inputToken === outputToken) {
      setPrice(0)
      return
    }

    try {
      const [token1Bal, token2Bal] = await Promise.all([
        amm.token1Balance(),
        amm.token2Balance(),
      ])

      // Check if pool has liquidity
      if (token1Bal.isZero() || token2Bal.isZero()) {
        setPrice(0)
        return
      }

      // Convert to readable amounts
      const dpcAmount = parseFloat(ethers.utils.formatEther(token1Bal))
      const usdkAmount = parseFloat(ethers.utils.formatEther(token2Bal))

      // Calculate price based on input token
      const calculatedPrice =
        inputToken === "DPC"
          ? usdkAmount / dpcAmount // How many USDK per DPC
          : dpcAmount / usdkAmount // How many DPC per USDK

      setPrice(calculatedPrice)
    } catch (error) {
      console.error("Error getting price:", error)
      setPrice(0)
    }
  }, [inputToken, outputToken, amm])

  useEffect(() => {
    if (amm && inputToken && outputToken) {
      getPrice()
    }
  }, [inputToken, outputToken, amm, getPrice])

  // Handle toast notifications based on swap state changes
  useEffect(() => {
    if (isSwapping) {
      showToast("info", "Swap Pending...")
    }
  }, [isSwapping])

  useEffect(() => {
    if (isSuccess && transactionHash) {
      showToast("success", "Swap Successful!", transactionHash)
      // Reload balances and price after successful swap
      loadBalances(amm, tokens, account, dispatch)
      getPrice()
      // Clear input fields after successful transaction
      setInputAmount(0)
      setOutputAmount(0)
      // Reset the success state to prevent duplicate toasts
      dispatch(swapReset())
    }
  }, [isSuccess, transactionHash, amm, tokens, account, dispatch, getPrice])

  useEffect(() => {
    if (!isSuccess && !isSwapping && errorMessage) {
      showToast("danger", errorMessage)
      // Reset the error state to prevent duplicate toasts
      dispatch(swapReset())
    }
  }, [isSuccess, isSwapping, errorMessage, dispatch])

  return (
    <div className="swap-container">
      <Card style={{ maxWidth: "450px" }} className="mx-auto px-4">
        {account ? (
          <Form
            onSubmit={swapHandler}
            style={{ maxWidth: "450px", margin: "50px auto" }}
          >
            <Row className="my-3">
              <div className="d-flex justify-content-between">
                <Form.Label>
                  <strong className="text-muted">SELL: </strong>
                </Form.Label>
                <Form.Text muted>
                  Balance:{" "}
                  {inputToken === symbols[0]
                    ? balances[0]
                    : inputToken === symbols[1]
                    ? balances[1]
                    : 0}
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  min="0.0"
                  step="any"
                  onChange={e => inputHandler(e)}
                  disabled={!inputToken}
                />
                <DropdownButton
                  variant="outline-secondary"
                  title={inputToken ? inputToken : "Select Token"}
                >
                  <Dropdown.Item
                    onClick={e => setInputToken(e.target.innerHTML)}
                  >
                    DPC
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={e => setInputToken(e.target.innerHTML)}
                  >
                    USDK
                  </Dropdown.Item>
                </DropdownButton>
              </InputGroup>
            </Row>
            <Row className="my-3">
              <div className="d-flex justify-content-between">
                <Form.Label>
                  <strong className="text-muted">BUY: </strong>
                </Form.Label>
                <Form.Text muted>
                  Balance:
                  {outputToken === symbols[0]
                    ? balances[0]
                    : outputToken === symbols[1]
                    ? balances[1]
                    : 0}
                </Form.Text>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  value={outputAmount === 0 ? "" : outputAmount}
                  disabled
                />
                <DropdownButton
                  variant="outline-secondary"
                  title={outputToken ? outputToken : "Select Token"}
                >
                  <Dropdown.Item
                    onClick={e => setOutputToken(e.target.innerHTML)}
                  >
                    DPC
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={e => setOutputToken(e.target.innerHTML)}
                  >
                    USDK
                  </Dropdown.Item>
                </DropdownButton>
              </InputGroup>
            </Row>

            {/* Price Impact and Slippage Settings */}
            <Row className="mt-4 mb-5">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <small className="text-muted">
                  Price Impact:
                  <Badge
                    bg={
                      priceImpact > 5
                        ? "danger"
                        : priceImpact > 2
                        ? "warning"
                        : "success"
                    }
                    className="ms-1"
                  >
                    {priceImpact.toFixed(2)}%
                  </Badge>
                </small>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="d-flex align-items-center gap-1 py-1 px-2"
                  style={{ fontSize: "0.813rem" }}
                >
                  <i className="bi bi-sliders2-vertical"></i>
                  <span>{showAdvanced ? "Hide" : "Settings"}</span>
                </Button>
              </div>

              {showAdvanced && (
                <div className="border rounded my-2 p-3 mb-2 bg-light">
                  <Form.Label className="small">
                    <strong>Slippage Tolerance</strong>
                  </Form.Label>
                  <div className="d-flex gap-2 mb-2">
                    {[0.1, 0.3, 0.5, 1.0].map(tolerance => (
                      <Button
                        key={tolerance}
                        size="sm"
                        variant={
                          slippageTolerance === tolerance
                            ? "primary"
                            : "outline-secondary"
                        }
                        onClick={() => setSlippageTolerance(tolerance)}
                      >
                        {tolerance}%
                      </Button>
                    ))}
                  </div>
                  <InputGroup size="sm">
                    <Form.Control
                      type="number"
                      placeholder="Custom %"
                      min="0.01"
                      max="5"
                      step="0.01"
                      value={slippageTolerance}
                      onChange={e =>
                        setSlippageTolerance(parseFloat(e.target.value) || 0.5)
                      }
                    />
                    <InputGroup.Text>%</InputGroup.Text>
                  </InputGroup>
                  <Form.Text className="text-muted small">
                    Minimum received:{" "}
                    {calculateMinimumOutput(outputAmount, slippageTolerance)}{" "}
                    {outputToken}
                  </Form.Text>

                  <hr className="my-3" />

                  <Form.Label className="small">
                    <strong>Transaction Deadline</strong>
                  </Form.Label>
                  <div className="d-flex gap-2 mb-2">
                    {[10, 20, 30, 60].map(minutes => (
                      <Button
                        key={minutes}
                        size="sm"
                        variant={
                          deadlineMinutes === minutes
                            ? "primary"
                            : "outline-secondary"
                        }
                        onClick={() => setDeadlineMinutes(minutes)}
                      >
                        {minutes}m
                      </Button>
                    ))}
                  </div>
                  <InputGroup size="sm">
                    <Form.Control
                      type="number"
                      placeholder="Custom minutes"
                      min="1"
                      max="120"
                      step="1"
                      value={deadlineMinutes}
                      onChange={e =>
                        setDeadlineMinutes(parseInt(e.target.value) || 20)
                      }
                    />
                    <InputGroup.Text>min</InputGroup.Text>
                  </InputGroup>
                  <Form.Text className="text-muted small">
                    Transaction expires in {deadlineMinutes} minutes if not
                    executed
                  </Form.Text>
                </div>
              )}
            </Row>

            <div className="my-3">
              {isSwapping ? (
                <Spinner
                  animation="border"
                  style={{ display: "block", margin: "0 auto" }}
                />
              ) : (
                <Button
                  type="submit"
                  className="w-100"
                  variant={
                    priceImpact > 10
                      ? "danger"
                      : priceImpact > 5
                      ? "warning"
                      : "primary"
                  }
                  disabled={
                    !inputToken ||
                    !outputToken ||
                    inputToken === outputToken ||
                    !inputAmount ||
                    parseFloat(inputAmount) <= 0 ||
                    !outputAmount ||
                    parseFloat(outputAmount) <= 0
                  }
                >
                  {!inputToken || !outputToken
                    ? "Select Tokens"
                    : inputToken === outputToken
                    ? "Invalid Token Pair"
                    : !inputAmount || parseFloat(inputAmount) <= 0
                    ? "Enter Amount"
                    : priceImpact > 10
                    ? "Swap Anyway"
                    : priceImpact > 5
                    ? "Swap (High Impact)"
                    : "Swap"}
                </Button>
              )}
            </div>
            <div className="my-3">
              {/* Pool Base Price */}
              <Form.Text muted>
                Pool Price:{" "}
                {price === 0
                  ? "Select tokens"
                  : `1 ${inputToken} = ${price.toFixed(6)} ${outputToken}`}
              </Form.Text>

              {/* Your Effective Trade Price */}
              {inputAmount > 0 && outputAmount > 0 && (
                <div className="mt-1">
                  <Form.Text className="small">
                    Your Rate: 1 {inputToken} ={" "}
                    {(
                      parseFloat(outputAmount) / parseFloat(inputAmount)
                    ).toFixed(6)}{" "}
                    {outputToken}
                    <Badge
                      bg={
                        priceImpact > 5
                          ? "danger"
                          : priceImpact > 2
                          ? "warning"
                          : "success"
                      }
                      className="ms-2"
                      title={`Price difference from pool rate. Large trades move the price ${
                        priceImpact > 2 ? "significantly" : "slightly"
                      }.`}
                    >
                      {priceImpact > 0.01
                        ? `${priceImpact > price ? "+" : "-"}${Math.abs(
                            ((parseFloat(outputAmount) /
                              parseFloat(inputAmount) -
                              price) /
                              price) *
                              100
                          ).toFixed(2)}%`
                        : "0.00%"}
                    </Badge>
                  </Form.Text>
                </div>
              )}

              {inputAmount > 0 && outputAmount > 0 && priceImpact > 1 && (
                <div className="mt-4">
                  <div className="small text-muted border-start border-2 border-warning ps-2">
                    <strong>Price Impact:</strong> Your trade is large enough to
                    move the pool price.
                    {priceImpact > 5 &&
                      " Consider splitting into smaller trades to reduce slippage."}
                  </div>
                </div>
              )}
            </div>
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

export default Swap
