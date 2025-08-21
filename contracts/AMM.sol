//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

// Manage Pool
// Manage Deposits
// Facilitate Swaps
// Manage Withdraws

contract AMM {

    Token public token1;
    Token public token2;

    uint256 public token1Balance;
    uint256 public token2Balance;
    uint256 public K;
    uint256 public totalShares;
    uint256 constant PRECISION = 10**18;
    mapping(address => uint256) public shares;


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

    // Compute token2 deposit relative to amount of token1 deposit
    function calculateToken2Deposit(uint256 _token1Amount) 
        public 
        view 
        returns(uint256 token2Amount) 
    {
        token2Amount = (token2Balance * _token1Amount) / token1Balance;
    }

    // Compute token1 deposit relative to amount of token2 deposit
    function calculateToken1Deposit(uint256 _token2Amount)
        public
        view
        returns(uint256 token1Amount)
    {
        token1Amount = (token1Balance * _token2Amount) / token2Balance;        
    }
}
