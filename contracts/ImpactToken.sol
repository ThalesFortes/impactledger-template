// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract ImpactToken is ERC20Votes, Ownable {
    uint256 public constant MINT_RATE = 1_000;

    event TokensMinted(address indexed to, uint256 amount, string reason);

    constructor()
        ERC20("ImpactToken", "IMPACT")
        EIP712("ImpactToken", "1")
        Ownable(msg.sender)
    {}


    function mint(address to, uint256 amount, string calldata reason) external onlyOwner {
        _mint(to, amount * (10 ** decimals()));
        emit TokensMinted(to, amount * (10 ** decimals()), reason);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Votes)
    {
        super._update(from, to, value);
        if (from == address(0) && delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }
}
