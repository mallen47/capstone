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
import { addLiquidity, loadBalances } from "../store/interactions"
import { depositReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Deposit = () => {
  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)
  const amm = useSelector(state => state.amm.contract)
  const isDepositing = useSelector(state => state.amm.depositing.isDepositing)
  const isSuccess = useSelector(state => state.amm.depositing.isSuccess)
  const transactionHash = useSelector(
    state => state.amm.depositing.transactionHash
  )

  const [token1Amount, setToken1Amount] = useState(0)
  const [token2Amount, setToken2Amount] = useState(0)
  const [poolRatio, setPoolRatio] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const errorMessage = useSelector(state => state.amm.depositing.errorMessage)
  const dispatch = useDispatch()

  // Get current pool ratio for display
  const getPoolRatio = useCallback(async () => {
    if (!amm) return

    try {
      const [token1Bal, token2Bal, totalShares] = await Promise.all([
        amm.token1Balance(),
        amm.token2Balance(),
        amm.totalShares(),
      ])

      if (totalShares.gt(0)) {
        const ratio1 = parseFloat(ethers.utils.formatEther(token1Bal))
        const ratio2 = parseFloat(ethers.utils.formatEther(token2Bal))
        setPoolRatio({ token1: ratio1, token2: ratio2 })
      } else {
        setPoolRatio(null)
      }
    } catch (error) {
      console.error("Error getting pool ratio:", error)
      setPoolRatio(null)
    }
  }, [amm])

  // Max button handlers
  const setMaxToken1 = () => {
    if (balances[0]) {
      const maxAmount = balances[0]
      setToken1Amount(maxAmount)
      // Trigger proportional calculation
      const event = { target: { id: "token1", value: maxAmount } }
      amountHandler(event)
    }
  }

  const setMaxToken2 = () => {
    if (balances[1]) {
      const maxAmount = balances[1]
      setToken2Amount(maxAmount)
      // Trigger proportional calculation
      const event = { target: { id: "token2", value: maxAmount } }
      amountHandler(event)
    }
  }

  const amountHandler = async e => {
    const inputValue = e.target.value

    // Early return for empty/invalid inputs
    if (!inputValue || inputValue === "" || parseFloat(inputValue) <= 0) {
      if (e.target.id === "token1") {
        setToken1Amount(inputValue)
        setToken2Amount(0)
      } else {
        setToken2Amount(inputValue)
        setToken1Amount(0)
      }
      return
    }

    if (!amm) {
      showToast(
        "warning",
        "AMM contract not loaded yet. Please wait and try again."
      )
      return
    }

    try {
      setIsCalculating(true)

      if (e.target.id === "token1") {
        setToken1Amount(inputValue)
        const _token1Amount = ethers.utils.parseUnits(inputValue, "ether")
        const result = await amm.calculateToken2Deposit(_token1Amount)
        const _token2Amount = ethers.utils.formatUnits(
          result.toString(),
          "ether"
        )
        setToken2Amount(_token2Amount)
      } else {
        setToken2Amount(inputValue)
        const _token2Amount = ethers.utils.parseUnits(inputValue, "ether")
        const result = await amm.calculateToken1Deposit(_token2Amount)
        const _token1Amount = ethers.utils.formatUnits(
          result.toString(),
          "ether"
        )
        setToken1Amount(_token1Amount)
      }
    } catch (error) {
      console.error("Error calculating proportional deposit:", error)
      if (error.message.includes("Pool not initialized")) {
        showToast(
          "info",
          "Pool not initialized yet. You can provide any amounts for the first deposit."
        )
      } else {
        showToast(
          "warning",
          "Error calculating proportional amounts. Please check your input."
        )
      }
    } finally {
      setIsCalculating(false)
    }
  }

  const depositHandler = async e => {
    e.preventDefault()

    // Validate inputs before parsing
    if (
      !token1Amount ||
      token1Amount === "" ||
      parseFloat(token1Amount) <= 0 ||
      !token2Amount ||
      token2Amount === "" ||
      parseFloat(token2Amount) <= 0
    ) {
      return
    }

    const _token1Amount = ethers.utils.parseUnits(
      token1Amount.toString(),
      "ether"
    )
    const _token2Amount = ethers.utils.parseUnits(
      token2Amount.toString(),
      "ether"
    )

    await addLiquidity(
      provider,
      amm,
      tokens,
      [_token1Amount, _token2Amount],
      dispatch
    )

    await loadBalances(amm, tokens, account, dispatch)
  }

  useEffect(() => {
    if (amm) {
      getPoolRatio()
    }
  }, [amm, getPoolRatio])

  useEffect(() => {
    if (isDepositing) {
      showToast("info", "Deposit Pending...")
    }
  }, [isDepositing])

  useEffect(() => {
    if (isSuccess && transactionHash) {
      showToast("success", "Deposit Successful!", transactionHash)
      // Reload balances after successful deposit
      loadBalances(amm, tokens, account, dispatch)
      // Clear input fields after successful transaction
      setToken1Amount(0)
      setToken2Amount(0)
      // Reset the success state to prevent duplicate toasts
      dispatch(depositReset())
    }
  }, [isSuccess, transactionHash, amm, tokens, account, dispatch])

  useEffect(() => {
    if (!isSuccess && !isDepositing && errorMessage) {
      showToast("danger", errorMessage)
      // Reset the error state to prevent duplicate toasts
      dispatch(depositReset())
    }
  }, [isSuccess, isDepositing, errorMessage, dispatch])

  return (
    <div>
      <Card style={{ maxWidth: "450px" }} className="mx-auto px-4">
        {account ? (
          <Form
            onSubmit={depositHandler}
            style={{ maxWidth: "450px", margin: "50px auto" }}
          >
            {/* Pool Ratio Information */}
            {poolRatio && (
              <Row className="mb-3">
                <div className="text-center">
                  <Badge bg="info" className="p-2">
                    Pool Ratio: {poolRatio.token1.toFixed(2)} {symbols[0]} :{" "}
                    {poolRatio.token2.toFixed(2)} {symbols[1]}
                  </Badge>
                </div>
              </Row>
            )}

            <Row>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Text muted>Balance: {balances[0]}</Form.Text>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={setMaxToken1}
                  disabled={!balances[0] || parseFloat(balances[0]) === 0}
                >
                  Max
                </Button>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  min="0.0"
                  step="any"
                  id="token1"
                  onChange={e => amountHandler(e)}
                  value={token1Amount === 0 ? "" : token1Amount}
                  disabled={isCalculating}
                />
                <InputGroup.Text
                  style={{ width: "100px" }}
                  className="justify-content-center"
                >
                  {symbols && symbols[0]}{" "}
                  {isCalculating && <Spinner size="sm" />}
                </InputGroup.Text>
              </InputGroup>
            </Row>
            <Row className="my-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Text muted>Balance: {balances[1]}</Form.Text>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={setMaxToken2}
                  disabled={!balances[1] || parseFloat(balances[1]) === 0}
                >
                  Max
                </Button>
              </div>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="0.0"
                  step="any"
                  id="token2"
                  onChange={e => {
                    amountHandler(e)
                  }}
                  value={token2Amount === 0 ? "" : token2Amount}
                  disabled={isCalculating}
                />
                <InputGroup.Text
                  style={{ width: "100px" }}
                  className="justify-content-center"
                >
                  {symbols && symbols[1]}{" "}
                  {isCalculating && <Spinner size="sm" />}
                </InputGroup.Text>
              </InputGroup>
            </Row>
            <Row className="my-4">
              {isDepositing ? (
                <Spinner
                  animation="border"
                  style={{ display: "block", margin: "0 auto" }}
                />
              ) : (
                <Button type="submit">Deposit</Button>
              )}
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

export default Deposit
