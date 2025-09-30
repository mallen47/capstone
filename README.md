# Shaker AMM

Shaker is a DeFi trading platform created for educational purposes. Built with Solidity, React and Redux and inspired by Uniswap V2 it features a constant product automated market maker (x × y = k) and supports trading any ERC-20 token pair.

## Project Overview

- **Constant Product AMM**: Uniswap V2-style automated market maker
- **Liquidity Pools**: Token swapping and liquidity provision
- **Advanced Analytics**: LP token valuation, impermanent loss tracking, and yield farming metrics
- **MEV Protection**: Slippage tolerance and transaction deadline controls
- **Price Oracle**: Real-time price feeds for external protocol integration

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MetaMask browser extension

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd capstone
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```
   PRIVATE_KEYS="your_private_key_here"
   ALCHEMY_API_KEY="your_alchemy_api_key_here"
   ```

   **Note**: Never commit your `.env` file to version control!

## Development Workflow

### 1. Start Local Blockchain

Start a local Hardhat node:

```bash
npx hardhat node
```

This will:

- Start a local blockchain on `http://127.0.0.1:8545/`
- Display 20 test accounts with private keys
- Run on Chain ID: 31337

### 2. Deploy Smart Contracts

In a new terminal, deploy contracts to localhost:

```bash
npx hardhat run --network localhost scripts/deploy.js
```

This will deploy:

- DappCoin (DPC) token
- USDK stablecoin token
- AMM contract

### 3. Seed Initial Liquidity (Optional)

Add initial liquidity and generate swap history:

```bash
npx hardhat run --network localhost scripts/seed.js
```

This will:

- Add liquidity to the pool
- Execute sample swaps
- Create transaction history for charts

### 4. Start React Frontend

```bash
npm start
```

The app will open at `http://localhost:3000`

### 5. Connect MetaMask

1. Add Localhost network to MetaMask:

   - **Network Name**: Localhost 8545
   - **RPC URL**: http://127.0.0.1:8545
   - **Chain ID**: 31337
   - **Currency Symbol**: ETH

2. Import a test account using one of the private keys from Hardhat node

3. Connect MetaMask to the app

## Testing

### Run Smart Contract Tests

Run the comprehensive test suite (39 tests):

```bash
npx hardhat test
```

### Run Specific Test File

```bash
npx hardhat test test/AMM.js
```

### Run Tests with Gas Reporting

```bash
REPORT_GAS=true npx hardhat test
```

### Test Coverage

```bash
npx hardhat coverage
```

## Network Deployment

### Deploy to Sepolia Testnet

1. **Get Sepolia ETH**

   - Use a Sepolia faucet (e.g., Alchemy, Infura)
   - Add funds to your deployment wallet

2. **Deploy contracts**

   ```bash
   npx hardhat run --network sepolia scripts/deploy.js
   ```

3. **Update config.json**

   - Contract addresses will be displayed in the console
   - Update `config.json` with the new addresses

4. **Seed liquidity (optional)**
   ```bash
   npx hardhat run --network sepolia scripts/seed.js
   ```

### Supported Networks

- **Localhost** (Chain ID: 31337) - Local development
- **Sepolia** (Chain ID: 11155111) - Ethereum testnet

## Features

### Smart Contract Features

- Token Swapping: Constant product AMM with 0.3% trading fee
- Liquidity Provision: Proportional deposits with LP token issuance
- Liquidity Removal: Burn LP tokens to withdraw assets
- Price Oracle: Real-time price feeds and pool statistics
- MEV Protection: Slippage tolerance and deadline enforcement
- Security: ReentrancyGuard, minimum liquidity lock, pool drainage prevention

### Frontend Features

- Swap Interface: Real-time price calculation with price impact warnings
- Deposit Interface: Proportional calculator with Max buttons
- Withdraw Interface: LP analytics, IL calculator, yield farming metrics
- Charts Dashboard: Swap history visualization and pool statistics
- Advanced Settings: Configurable slippage tolerance (0.1% - 1.0%)
- Transaction Deadlines: User-set expiration (10-120 minutes)
- Educational Tooltips: Hover explanations for all DeFi terms
- Multi-Network Support: Seamless localhost and Sepolia switching

## Key Contracts

### AMM.sol

The core automated market maker implementing:

- Constant product formula (x × y = k)
- 0.3% trading fees distributed to liquidity providers
- Proportional liquidity deposits and withdrawals
- Price oracle functions for external integrations
- MEV-resistant swap execution

### Token.sol

Standard ERC-20 token with:

- Minting capability
- Standard transfer functions
- Allowance mechanisms

## Learning Outcomes

This project demonstrates:

- Smart contract development with Solidity
- DeFi protocol mechanics (AMM, liquidity pools, token swaps)
- Test-driven development for blockchain
- Gas optimization and security best practices
- React application architecture with Redux
- Blockchain interaction with Ethers.js
- MEV protection and user safety mechanisms

## Common Commands

```bash
# Install dependencies
npm install

# Start local blockchain
npx hardhat node

# Deploy contracts locally
npx hardhat run --network localhost scripts/deploy.js

# Run tests
npx hardhat test

# Start React app
npm start

# Deploy to Sepolia
npx hardhat run --network sepolia scripts/deploy.js

# Seed liquidity
npx hardhat run --network localhost scripts/seed.js
```

## Security Considerations

- Never commit private keys or `.env` files
- Always test on localhost before deploying to testnet
- Verify contract addresses in `config.json` match deployments
- Use test accounts for development, never mainnet accounts
- Review transaction details in MetaMask before confirming

## License

ISC

## Author

<img src="https://github.com/mallen47.png" width="100" height="100" style="border-radius: 50%;" alt="Matt Allen">

**Matt Allen** - [GitHub](https://github.com/mallen47)

---

**Note**: This project was built to learn about blockchain development. It hasn't been audited for production use!
