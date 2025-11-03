import { useState } from "react"
import Navbar from "react-bootstrap/Navbar"
import Button from "react-bootstrap/Button"
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
  const [isHovered, setIsHovered] = useState(false)

  const connectHandler = async () => {
    const account = await loadAccount(dispatch)
    await loadBalances(amm, tokens, account, dispatch)
  }

  return (
    <Navbar className="mb-0" expand="lg">
      <div className="d-flex align-items-center">
        <img
          alt="logo"
          src={theme === "light" ? "/logoLight.svg" : "/logoDark.svg"}
          height="80"
          className="d-inline-block"
          style={{ marginRight: "2rem" }}
        />
      </div>
      <Navbar.Toggle aria-controls="nav" />
      <Navbar.Collapse id="nav" className="justify-content-end">
        <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
          {/* Theme Toggle */}
          <Button
            variant="outline-secondary"
            onClick={toggleTheme}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="theme-toggle-btn"
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
            style={{
              width: "40px",
              height: "40px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i
              className={
                theme === "light"
                  ? isHovered
                    ? "bi bi-moon-stars"
                    : "bi bi-moon-stars-fill"
                  : "bi bi-sun-fill"
              }
            ></i>
          </Button>

          {/* Settings Group: Network Selection */}
          <div className="nav-settings-group">
            <NetworkDropdown chainId={chainId} />
          </div>

          {/* Wallet Connection Group */}
          <div className="nav-wallet-group">
            {account ? (
              <Button
                variant="outline-primary"
                className="d-flex align-items-center gap-2 nav-account-btn"
                style={{
                  height: "40px",
                  paddingLeft: "12px",
                  paddingRight: "8px",
                }}
              >
                <span className="account-address">
                  {account.slice(0, 5) + "..." + account.slice(38, 42)}
                </span>
                <Blockies
                  seed={account}
                  size={10}
                  scale={3}
                  color="#2187D0"
                  bgColor="#F1F2F9"
                  spotcolor="#767F92"
                  className="identicon"
                ></Blockies>
              </Button>
            ) : (
              <Button onClick={connectHandler} style={{ height: "40px" }}>
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </Navbar.Collapse>
    </Navbar>
  )
}

export default Navigation
