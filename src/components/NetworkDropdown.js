import { Dropdown, DropdownButton } from "react-bootstrap"
import config from "../config.json"

const NetworkDropdown = ({ chainId, onNetworkChange }) => {
  // Network configuration
  const networks = [
    { name: "Localhost", chainId: "0x7A69" },
    { name: "Sepolia", chainId: "0xAA36A7" },
  ]

  // Get current network name
  const getCurrentNetworkName = () => {
    if (!chainId || !config[chainId]) {
      return "Select Network"
    }
    const hexChainId = `0x${chainId.toString(16).toUpperCase()}`
    const network = networks.find(
      n => n.chainId.toLowerCase() === hexChainId.toLowerCase()
    )
    return network ? network.name : "Unknown Network"
  }

  const handleNetworkSelect = async chainIdHex => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      })
      if (onNetworkChange) {
        onNetworkChange(chainIdHex)
      }
    } catch (error) {
      console.error("Error switching network:", error)
    }
  }

  return (
    <DropdownButton
      variant="outline-secondary"
      title={getCurrentNetworkName()}
      className="network-dropdown"
      onSelect={handleNetworkSelect}
    >
      {networks.map(network => (
        <Dropdown.Item
          key={network.chainId}
          eventKey={network.chainId}
          active={
            config[chainId] &&
            `0x${chainId.toString(16)}`.toLowerCase() ===
              network.chainId.toLowerCase()
          }
        >
          {network.name}
        </Dropdown.Item>
      ))}
    </DropdownButton>
  )
}

export default NetworkDropdown
