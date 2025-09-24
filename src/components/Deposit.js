import Card from "react-bootstrap/Card"
import Form from "react-bootstrap/Form"
import Row from "react-bootstrap/Row"
import InputGroup from "react-bootstrap/InputGroup"
import DropdownButton from "react-bootstrap/DropdownButton"
import Dropdown from "react-bootstrap/Dropdown"
import Button from "react-bootstrap/Button"

const Deposit = () => {
  return (
    <div>
      <Card style={{ maxWidth: "450px" }} className="mx-auto px-4">
        <Form style={{ maxWidth: "450px", margin: "50px auto" }}>
          <Row>
            <Form.Text className="text-end my-2" muted>
              Balance:
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="number"
                placeholder="0.0"
                min="0.0"
                step="any"
                id="token1"
              />
              <InputGroup.Text
                style={{ width: "100px" }}
                className="justify-content-center"
              ></InputGroup.Text>
            </InputGroup>
          </Row>
          <Row className="my-3">
            <Form.Text className="text-end my-2" muted>
              Balance:
            </Form.Text>

            <InputGroup>
              <Form.Control
                type="number"
                placeholder="0.0"
                step="any"
                id="token2"
              />
              <InputGroup.Text
                style={{ width: "100px" }}
                className="justify-content-center"
              ></InputGroup.Text>
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
