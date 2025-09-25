import { ethers } from "ethers"
import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import InputGroup from "react-bootstrap/InputGroup"
import Spinner from "react-bootstrap/Spinner"
import Button from "react-bootstrap/Button"
import { removeLiquidity } from "../store/interactions"
import { depositReset } from "../store/reducers/amm"
import { showToast } from "../utils/toastService"

const Withdraw = () => {
  const [amount, setAmount] = useState(0)

  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const balances = useSelector(state => state.tokens.balances)
  const shares = useSelector(state => state.amm.shares)
  const amm = useSelector(state => state.amm.contract)
  const isWithdrawing = useSelector(
    state => state.amm.withdrawing.isWithdrawing
  )
  const isSuccess = useSelector(state => state.amm.withdrawing.isSuccess)
  const transactionHash = useSelector(
    state => state.amm.depositing.transactionHash
  )

  const dispatch = useDispatch()

  const withdrawHandler = async e => {
    e.preventDefault()

    const _shares = ethers.utils.parseUnits(amount.toString(), "ether")

    await removeLiquidity(provider, amm, _shares, dispatch)
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
              <Button type="submit">Withdraw</Button>
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
