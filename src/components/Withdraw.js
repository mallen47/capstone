import { ethers } from "ethers"
import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import InputGroup from "react-bootstrap/InputGroup"
import Spinner from "react-bootstrap/Spinner"
import Button from "react-bootstrap/Button"
import { removeLiquidity, loadBalances } from "../store/interactions"
import { withdrawReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Withdraw = () => {
  const [amount, setAmount] = useState(0)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const balances = useSelector(state => state.tokens.balances)
  const shares = useSelector(state => state.amm.shares)
  const tokens = useSelector(state => state.tokens.contracts)
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
      // Clear input field after successful transaction
      setAmount(0)
      // Reset the success state to prevent duplicate toasts
      dispatch(withdrawReset())
    }
  }, [isSuccess, transactionHash, amm, tokens, account, dispatch])

  useEffect(() => {
    if (!isSuccess && !isWithdrawing && errorMessage) {
      showToast("danger", errorMessage)
      dispatch(withdrawReset())
    }
  }, [isSuccess, isWithdrawing, errorMessage, dispatch])

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
            <Row>
              <Form.Text className="text-end my-2" muted>
                Shares: {shares}
              </Form.Text>
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
