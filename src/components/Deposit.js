import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import InputGroup from "react-bootstrap/InputGroup"
import DropdownButton from "react-bootstrap/DropdownButton"
import Dropdown from "react-bootstrap/Dropdown"
import Button from "react-bootstrap/Button"

const Deposit = () => {
  const provider = useSelector(state => state.provider.connection)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const symbols = useSelector(state => state.tokens.symbols)
  const balances = useSelector(state => state.tokens.balances)

  const amountHandler = async e => {
    e.preventDefault()
    console.log("amount handler...")
  }

  const depositHandler = async e => {
    e.preventDefault()
    console.log("deposit handler...")
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
            <Button type="submit">Deposit</Button>
          </Row>
        </Form>
      </Card>
    </div>
  )
}

export default Deposit
