//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

contract AMM {

    Token public token1;
    Token public token2;

    uint256 public token1Balance;
    uint256 public token2Balance;
    uint256 public K;
    uint256 public totalShares;
    uint256 constant PRECISION = 10**18;
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
            share = 100 * PRECISION;
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
        totalShares += share;
        shares[msg.sender] += share;
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
        uint256 token1After = token1Balance + _token1Amount;
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
        uint256 token2After = token2Balance + _token2Amount;
        uint256 token1After = K / token2After;
        token1Amount = token1Balance - token1After;

        // Don't let pool go to zero
        if(token1Amount == token1Balance) {
            token1Amount--;
        }

        require(token1Amount < token1Balance, "Swap cannot exceed pool balance");
    }

    function swapToken1(uint256 _token1Amount) 
        external 
        returns(uint256 token2Amount) {
            // Calculate Token2 amount            
            token2Amount = calculateToken1Swap(_token1Amount);

            // Do swap
            // 1. Transfer token1 tokens out of user wallet to contract
            token1.transferFrom(msg.sender, address(this), _token1Amount);
            // 2. Update contract's token1 balance
            token1Balance += _token1Amount;
            // 3. Update contract's token2 balance
            token2Balance -= token2Amount;
            // 4. Transfer token2 tokens from contract to user wallet
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

    function swapToken2(uint256 _token2Amount) 
        external 
        returns(uint256 token1Amount) {
            // Calculate Token1 amount            
            token1Amount = calculateToken2Swap(_token2Amount);
            // Do swap
            // 1. Transfer token1 tokens out of user wallet to contract
            token2.transferFrom(msg.sender, address(this), _token2Amount);
            // 2. Update contract's token1 balance
            token2Balance += _token2Amount;
            // 3. Update contract's token1 balance
            token1Balance -= token1Amount;
            // 4. Transfer token1 tokens from contract to user wallet
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
}
