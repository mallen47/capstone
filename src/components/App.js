import { useEffect } from "react"
import { useDispatch } from "react-redux"
import { HashRouter, Routes, Route } from "react-router-dom"
import { Container } from "react-bootstrap"
import { ToastContainer, toast } from "react-toastify"
import { ThemeProvider } from "../contexts/ThemeContext"
import Navigation from "./Navigation"
import {
  loadAccount,
  loadProvider,
  loadNetwork,
  loadTokens,
  loadAMM,
} from "../store/interactions"
import { useTheme } from "../contexts/ThemeContext"
import Swap from "./Swap"
import Deposit from "./Deposit"
import Withdraw from "./Withdraw"
import Charts from "./Charts"
import PoolStats from "./PoolStats"
import Tabs from "./Tabs"
import config from "../config.json"
import "react-toastify/dist/ReactToastify.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// App content component that uses theme context
function AppContent() {
  const dispatch = useDispatch()
  const { theme } = useTheme()

  const loadBlockchainData = async () => {
    try {
      // Initiate provider
      const provider = await loadProvider(dispatch)

      // Fetch current network's chainId (e.g. hardhat: 31337, sepolia: 11155111)
      const chainId = await loadNetwork(provider, dispatch)

      // Check if the network is supported
      if (!config[chainId]) {
        toast.error(
          `Unsupported network. Please switch to Localhost or Sepolia Network in MetaMask.`,
          {
            position: "bottom-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        )
        console.error("Unsupported network detected:", chainId)
        return
      }

      // Reload page when network changes
      window.ethereum.on("chainChanged", async () => {
        console.log("Network changed, reloading...")
        try {
          const provider = await loadProvider(dispatch)
          const newChainId = await loadNetwork(provider, dispatch)

          // Check if new network is supported
          if (!config[newChainId]) {
            toast.error(
              `Network switch error. Unsupported network detected. Please switch to Localhost or Sepolia Network.`,
              {
                position: "bottom-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
              }
            )
            window.location.reload()
            return
          }

          window.location.reload()
        } catch (error) {
          console.error("Error handling network change:", error)
          toast.error(
            `Network switch error. Please reconnect your wallet and try again.`,
            {
              position: "bottom-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            }
          )
          window.location.reload()
        }
      })

      // Fetch current account from Metamask when changed
      window.ethereum.on("accountsChanged", async () => {
        console.log("Account changed!")
        await loadAccount(dispatch)
      })

      // Initiate contracts
      console.log("Loading tokens for chainId:", chainId)
      await loadTokens(provider, chainId, dispatch)
      console.log("Tokens loaded successfully")
      await loadAMM(provider, chainId, dispatch)
      console.log("AMM loaded successfully")
    } catch (error) {
      console.error("Error loading blockchain data:", error)
      toast.error(
        `Failed to connect to blockchain. Please check MetaMask and try again.`,
        {
          position: "bottom-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      )
    }
  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
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
          <Route path="/stats" element={<PoolStats />} />
        </Routes>
      </HashRouter>
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
        theme={theme === "dark" ? "dark" : "light"}
        toastClassName="custom-toast"
      />
    </Container>
  )
}

// Main App component that provides theme context
function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
