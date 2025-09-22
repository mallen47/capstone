import { useEffect } from "react"
import { useDispatch } from "react-redux"
import { HashRouter, Routes, Route } from "react-router-dom"
import { Container } from "react-bootstrap"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

// Theme Provider
import { ThemeProvider } from "../contexts/ThemeContext"

// Components
import Navigation from "./Navigation"
import {
  loadAccount,
  loadProvider,
  loadNetwork,
  loadTokens,
  loadAMM,
} from "../store/interactions"
import Swap from "./Swap"
import Deposit from "./Deposit"
import Withdraw from "./Withdraw"
import Charts from "./Charts"
import Tabs from "./Tabs"

function App() {
  const dispatch = useDispatch()

  const loadBlockchainData = async () => {
    // Initiate provider
    const provider = await loadProvider(dispatch)

    // Fetch current network's chainId (e.g. hardhat: 31337, sepolia: 11155111)
    const chainId = await loadNetwork(provider, dispatch)

    // Reload page when network changes
    window.ethereum.on("chainChanged", () => {
      console.log("chain changed!")
      window.location.reload()
    })

    // Fetch current account from Metamask when changed
    window.ethereum.on("accountsChanged", async () => {
      console.log("account changed!")
      await loadAccount(dispatch)
    })

    // Initiate contracts
    console.log("Loading tokens for chainId:", chainId)
    try {
      await loadTokens(provider, chainId, dispatch)
      console.log("Tokens loaded successfully")
      await loadAMM(provider, chainId, dispatch)
      console.log("AMM loaded successfully")
    } catch (error) {
      console.error("Error loading contracts:", error)
    }
  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <ThemeProvider>
      <Container>
        <HashRouter>
          <Navigation />
          <hr />
          <Tabs />
          <Routes>
            <Route exact path="/" element={<Swap />} />
            <Route path="/deposit" element={<Deposit />} />
            <Route path="/withdraw" element={<Withdraw />} />
            <Route path="/charts" element={<Charts />} />
          </Routes>
        </HashRouter>

        {/* Toast Container for notifications */}
        <ToastContainer
          position="bottom-right"
          autoClose={false}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={true}
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          toastClassName="custom-toast"
        />
      </Container>
    </ThemeProvider>
  )
}

export default App
