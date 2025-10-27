import Navbar from "react-bootstrap/Navbar"
import Button from "react-bootstrap/Button"
import logo from "../logo.png"
import { useSelector, useDispatch } from "react-redux"
import Blockies from "react-blockies"
import { loadAccount, loadBalances } from "../store/interactions"
import { useTheme } from "../contexts/ThemeContext"
import NetworkDropdown from "./NetworkDropdown"

const Navigation = () => {
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const chainId = useSelector(state => state.provider.chainId)
  const amm = useSelector(state => state.amm.contract)
  const dispatch = useDispatch()
  const { theme, toggleTheme } = useTheme()

  const connectHandler = async () => {
    const account = await loadAccount(dispatch)
    await loadBalances(amm, tokens, account, dispatch)
  }

  return (
    <Navbar className="my-3" expand="lg">
      <img
        alt="logo"
        src={logo}
        width="40"
        height="40"
        className="d-inline-block align-top mx-3"
      />
      <Navbar.Brand href="#">AMM</Navbar.Brand>
      <Navbar.Toggle aria-controls="nav" />
      <Navbar.Collapse id="nav" className="justify-content-end">
        <div className="d-flex justify-content-end mt-3">
          <Button
            variant="outline-secondary"
            onClick={toggleTheme}
            className="me-3 theme-toggle-btn"
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
          >
            <i
              className={
                theme === "light" ? "bi bi-moon-stars-fill" : "bi bi-sun-fill"
              }
            ></i>
          </Button>

          <NetworkDropdown chainId={chainId} />

          {account ? (
            <Navbar.Text className="d-flex align-items-center">
              {account.slice(0, 5) + "..." + account.slice(38, 42)}
              <Blockies
                seed={account}
                size={10}
                scale={3}
                color="#2187D0"
                bgColor="#F1F2F9"
                spotcolor="#767F92"
                className="identicon mx-2"
              ></Blockies>
            </Navbar.Text>
          ) : (
            <Button onClick={connectHandler}>Connect</Button>
          )}
        </div>
      </Navbar.Collapse>
    </Navbar>
  )
}

export default Navigation
