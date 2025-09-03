//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "./Token.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AMM is ReentrancyGuard {

    Token public token1;
    Token public token2;

    uint256 public token1Balance;
    uint256 public token2Balance;
    uint256 public K;
    uint256 public totalShares;
    uint256 constant PRECISION = 10**18;
    uint256 public constant MINIMUM_LIQUIDITY = 1000; // Permanently locked liquidity
    mapping(address => uint256) public shares;

    event Swap(
        address user,
        address tokenGive,
        uint256 tokenGiveAmount,
        address tokenGet,
        uint256 tokenGetAmount,
        uint256 token1Balance,
        uint256 token2Balance,
        uint256 timestamp
    );

    event LiquidityAdded(
        address user,
        uint256 shareAmount,
        uint256 token1Amount,
        uint256 token2Amount,
        uint256 timestamp
    );

    event LiquidityRemoved(
        address user,
        uint256 shareAmount,
        uint256 token1Amount,
        uint256 token2Amount,
        uint256 timestamp
    );

    constructor(Token _token1, Token _token2) {
        token1 = _token1;
        token2 = _token2;
    }

    function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
        // Deposit Tokens
        require(
            token1.transferFrom(msg.sender, address(this), _token1Amount),
            "Failed to transfer token1"   
        );

        require(
            token2.transferFrom(msg.sender, address(this), _token2Amount),
            "Failed to transfer token2"
        );
        
        // Issue shares
        uint256 share;
        if(totalShares == 0) {
            // First liquidity provider: lock minimum liquidity permanently
            require(_token1Amount > MINIMUM_LIQUIDITY && _token2Amount > MINIMUM_LIQUIDITY, 
                    "Initial liquidity must exceed minimum lock");
            share = 100 * PRECISION - MINIMUM_LIQUIDITY; // User gets shares minus locked amount
        } else {
            require(
                (totalShares * _token1Amount * token2Balance) == (totalShares * _token2Amount * token1Balance),
                "Must provide equal token amounts"
                );
            share = totalShares * _token1Amount / token1Balance;
        }

        // Manage pool
        token1Balance += _token1Amount;      
        token2Balance += _token2Amount;
        K = token1Balance * token2Balance;

        // Update shares
        if(totalShares == 0) {
            // Include locked liquidity in total shares for first deposit
            totalShares = 100 * PRECISION;
            shares[msg.sender] = share; // User gets reduced amount due to lock
        } else {
            totalShares += share;
            shares[msg.sender] += share;
        }

        // Emit event
        emit LiquidityAdded(msg.sender, share, _token1Amount, _token2Amount, block.timestamp);
    }

    // Compute token1 deposit relative to amount of token2 deposit
    function calculateToken1Deposit(uint256 _token2Amount)
        public
        view
        returns(uint256 token1Amount)
    {
        token1Amount = (token1Balance * _token2Amount) / token2Balance;        
    }
    
    // Compute token2 deposit relative to amount of token1 deposit
    function calculateToken2Deposit(uint256 _token1Amount) 
        public 
        view 
        returns(uint256 token2Amount) 
    {
        token2Amount = (token2Balance * _token1Amount) / token1Balance;
    }

    // returns amount of token2 received when swapping token1
    function calculateToken1Swap(uint256 _token1Amount)
        public
        view
        returns(uint256 token2Amount)    
    {
        // Apply 0.3% trading fee (997/1000 = 99.7% goes to pricing)
        uint256 token1AfterFee = _token1Amount * 997 / 1000;
        uint256 token1After = token1Balance + token1AfterFee;
        uint256 token2After = K / token1After;
        token2Amount = token2Balance - token2After;

        // Don't let pool go to zero
        if(token2Amount == token2Balance) {
            token2Amount--;
        }

        require(token2Amount < token2Balance, "Swap cannot exceed pool balance");
    }

    // returns amount of token1 received when swapping token2
    function calculateToken2Swap(uint256 _token2Amount)
        public
        view
        returns(uint256 token1Amount)    
    {
        // Apply 0.3% trading fee (997/1000 = 99.7% goes to pricing)
        uint256 token2AfterFee = _token2Amount * 997 / 1000;
        uint256 token2After = token2Balance + token2AfterFee;
        uint256 token1After = K / token2After;
        token1Amount = token1Balance - token1After;

        // Don't let pool go to zero
        if(token1Amount == token1Balance) {
            token1Amount--;
        }

        require(token1Amount < token1Balance, "Swap cannot exceed pool balance");
    }

    function swapToken1(
        uint256 _token1Amount,
        uint256 _minToken2Amount,
        uint256 _deadline
    ) 
        external 
        nonReentrant
        returns(uint256 token2Amount) {
            // Check deadline
            require(block.timestamp <= _deadline, "Transaction expired");
            
            // Calculate Token2 amount            
            token2Amount = calculateToken1Swap(_token1Amount);
            
            // Check slippage protection
            require(token2Amount >= _minToken2Amount, "Insufficient output amount");

            // Do swap
            // 1. Transfer token1 tokens out of user wallet to contract
            token1.transferFrom(msg.sender, address(this), _token1Amount);
            // 2. Update contract's token1 balance (includes fee!)
            token1Balance += _token1Amount;
            // 3. Update contract's token2 balance
            token2Balance -= token2Amount;
            // 4. Update K to reflect fee accumulation
            K = token1Balance * token2Balance;
            // 5. Transfer token2 tokens from contract to user wallet
            token2.transfer(msg.sender, token2Amount);

            // Emit event
            emit Swap(
                msg.sender,
                address(token1),
                _token1Amount,
                address(token2),
                token2Amount,
                token1Balance,
                token2Balance,
                block.timestamp
            );
    }

    function swapToken2(
        uint256 _token2Amount,
        uint256 _minToken1Amount,
        uint256 _deadline
    ) 
        external 
        nonReentrant
        returns(uint256 token1Amount) {
            // Check deadline
            require(block.timestamp <= _deadline, "Transaction expired");
            
            // Calculate Token1 amount            
            token1Amount = calculateToken2Swap(_token2Amount);
            
            // Check slippage protection
            require(token1Amount >= _minToken1Amount, "Insufficient output amount");
            
            // Do swap
            // 1. Transfer token2 tokens out of user wallet to contract
            token2.transferFrom(msg.sender, address(this), _token2Amount);
            // 2. Update contract's token2 balance (includes fee!)
            token2Balance += _token2Amount;
            // 3. Update contract's token1 balance
            token1Balance -= token1Amount;
            // 4. Update K to reflect fee accumulation
            K = token1Balance * token2Balance;
            // 5. Transfer token1 tokens from contract to user wallet
            token1.transfer(msg.sender, token1Amount);

            // Emit event
            emit Swap(
                msg.sender,
                address(token2),
                _token2Amount,
                address(token1),
                token1Amount,
                token2Balance,
                token1Balance,
                block.timestamp
            );
    }

    // Determine how many shares can be withdrawn
    function calculateWithdrawAmount(uint256 _share)
        public
        view
        returns(uint256 token1Amount, uint256 token2Amount)
    {
        require(_share <= totalShares, "Withdraw amount cannot exceed total shares");
        token1Amount = (_share * token1Balance) / totalShares;
        token2Amount = (_share * token2Balance) / totalShares;
    }

    // =============================================================
    // PRICE ORACLE FUNCTIONS
    // =============================================================

    // Returns current price of token1 in terms of token2 (with 18 decimals precision)
    function getPrice() external view returns (uint256 price) {
        require(token1Balance > 0 && token2Balance > 0, "Pool not initialized");
        price = (token2Balance * PRECISION) / token1Balance;
    }

    // Returns current pool reserves for external protocols
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1) {
        reserve0 = token1Balance;
        reserve1 = token2Balance;
    }

    // Returns the underlying token amounts for a given number of LP shares
    function getLPTokenValue(uint256 _shares) external view returns (uint256 token1Amount, uint256 token2Amount) {
        require(totalShares > 0, "No liquidity in pool");
        token1Amount = (_shares * token1Balance) / totalShares;
        token2Amount = (_shares * token2Balance) / totalShares;
    }

    // Returns total pool liquidity (K value)
    function getTotalLiquidity() external view returns (uint256 liquidity) {
        liquidity = K;
    }

    // Returns current trading volume capacity (useful for other protocols)
    function getPoolInfo() external view returns (
        uint256 reserve0,
        uint256 reserve1, 
        uint256 totalShares_,
        uint256 kValue
    ) {
        reserve0 = token1Balance;
        reserve1 = token2Balance;
        totalShares_ = totalShares;
        kValue = K;
    }

    // =============================================================
    // LIQUIDITY MANAGEMENT
    // =============================================================

    // Removes liquidity from the pool
    function removeLiquidity(uint256 _share)
        external
        nonReentrant
        returns(uint256 token1Amount, uint256 token2Amount)
    {
        require(_share <= shares[msg.sender], "Cannot withdraw shares in excess of allotted amount");
        
        // Prevent total liquidity drainage
        require(totalShares - _share >= MINIMUM_LIQUIDITY, "Cannot drain pool below minimum liquidity");
        
        (token1Amount, token2Amount) = calculateWithdrawAmount(_share);
        shares[msg.sender] -= _share;
        totalShares -= _share;
        token1Balance -= token1Amount;
        token2Balance -= token2Amount;
        K = token1Balance * token2Balance;
        token1.transfer(msg.sender, token1Amount);
        token2.transfer(msg.sender, token2Amount);

        emit LiquidityRemoved(msg.sender, _share, token1Amount, token2Amount, block.timestamp);

    }
}
