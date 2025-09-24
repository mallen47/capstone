import { ethers } from "ethers"
import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import InputGroup from "react-bootstrap/InputGroup"
import Spinner from "react-bootstrap/Spinner"
import Button from "react-bootstrap/Button"
import { addLiquidity, loadBalances } from "../store/interactions"

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
    state => state.amm.swapping.transactionHash
  )

  const [token1Amount, setToken1Amount] = useState(0)
  const [token2Amount, setToken2Amount] = useState(0)

  const dispatch = useDispatch()

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

    if (e.target.id === "token1") {
      setToken1Amount(inputValue)
      const _token1Amount = ethers.utils.parseUnits(inputValue, "ether")
      const result = await amm.calculateToken2Deposit(_token1Amount)
      const _token2Amount = ethers.utils.formatUnits(result.toString(), "ether")
      setToken2Amount(_token2Amount)
    } else {
      setToken2Amount(inputValue)
      const _token2Amount = ethers.utils.parseUnits(inputValue, "ether")
      const result = await amm.calculateToken1Deposit(_token2Amount)
      const _token1Amount = ethers.utils.formatUnits(result.toString(), "ether")
      setToken1Amount(_token1Amount)
    }
  }

  const depositHandler = async e => {
    e.preventDefault()

    const _token1Amount = ethers.utils.parseUnits(token1Amount, "ether")
    const _token2Amount = ethers.utils.parseUnits(token2Amount, "ether")

    await addLiquidity(
      provider,
      amm,
      tokens,
      [_token1Amount, _token2Amount],
      dispatch
    )

    await loadBalances(amm, tokens, account, dispatch)
  }

  return (
    <div>
      <Card style={{ maxWidth: "450px" }} className="mx-auto px-4">
        <Form
          onSubmit={depositHandler}
          style={{ maxWidth: "450px", margin: "50px auto" }}
        >
          <Row>
            <Form.Text className="text-end my-2" muted>
              Balance: {balances[0]}
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="number"
                placeholder="0.0"
                min="0.0"
                step="any"
                id="token1"
                onChange={e => amountHandler(e)}
                value={token1Amount === 0 ? "" : token1Amount}
              />
              <InputGroup.Text
                style={{ width: "100px" }}
                className="justify-content-center"
              >
                {symbols && symbols[0]}
              </InputGroup.Text>
            </InputGroup>
          </Row>
          <Row className="my-3">
            <Form.Text className="text-end my-2" muted>
              Balance: {balances[1]}
            </Form.Text>
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
              />
              <InputGroup.Text
                style={{ width: "100px" }}
                className="justify-content-center"
              >
                {symbols && symbols[1]}
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
      </Card>
    </div>
  )
}

export default Deposit
