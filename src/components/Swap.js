import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { ethers } from "ethers"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import InputGroup from "react-bootstrap/InputGroup"
import Dropdown from "react-bootstrap/Dropdown"
import DropdownButton from "react-bootstrap/DropdownButton"
import Button from "react-bootstrap/Button"
import Row from "react-bootstrap/Row"
import Spinner from "react-bootstrap/Spinner"
import { swap, loadBalances } from "../store/interactions"
import { showToast } from "../utils/toastService"

const Swap = () => {
  const [inputToken, setInputToken] = useState(null)
  const [outputToken, setOutputToken] = useState(null)
  const [inputAmount, setInputAmount] = useState(0)
  const [outputAmount, setOutputAmount] = useState(0)
  const [price, setPrice] = useState(0)
  const [showAlert, setShowAlert] = useState(false)

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
    if (!inputValue || inputValue === "" || isNaN(inputValue) || parseFloat(inputValue) <= 0) {
      setOutputAmount(0)
      return
    }
    
    try {
      if (inputToken === "DPC") {
        const result = await amm.calculateToken1Swap(
          ethers.utils.parseUnits(inputValue, "ether")
        )
        const _token2Amount = ethers.utils.formatUnits(result.toString(), "ether")
        setOutputAmount(_token2Amount.toString())
      } else {
        const result = await amm.calculateToken2Swap(
          ethers.utils.parseUnits(inputValue, "ether")
        )
        const _token1Amount = ethers.utils.formatUnits(result.toString(), "ether")
        setOutputAmount(_token1Amount.toString())
      }
    } catch (error) {
      console.error("Error calculating swap amount:", error)
      setOutputAmount(0)
    }
  }

  const swapHandler = async e => {
    e.preventDefault()

    setShowAlert(false)

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

    const _inputAmount = ethers.utils.parseUnits(inputAmount.toString(), "ether")

    if (inputToken === "DPC") {
      await swap(provider, amm, tokens[0], inputToken, _inputAmount, dispatch)
    } else {
      await swap(provider, amm, tokens[1], inputToken, _inputAmount, dispatch)
    }

    setShowAlert(true)
  }

  const getPrice = async () => {
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
  }

  useEffect(() => {
    if (amm && inputToken && outputToken) {
      getPrice()
    }
  }, [inputToken, outputToken, amm])

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
    }
  }, [isSuccess, transactionHash])

  useEffect(() => {
    if (showAlert && !isSuccess && !isSwapping && errorMessage) {
      showToast("danger", errorMessage)
    }
  }, [showAlert, isSuccess, isSwapping, errorMessage])

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
                  <strong>Input: </strong>
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
                  <strong>Output: </strong>
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
            <Row className="my-3">
              {isSwapping ? (
                <Spinner
                  animation="border"
                  style={{ display: "block", margin: "0 auto" }}
                />
              ) : (
                <Button type="submit">Swap</Button>
              )}
              <Form.Text muted>
                Exchange Rate:{" "}
                {price === 0
                  ? "Select tokens"
                  : `1 ${inputToken} = ${price.toFixed(6)} ${outputToken}`}
              </Form.Text>
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

export default Swap
