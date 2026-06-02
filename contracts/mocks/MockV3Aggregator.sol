// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockV3Aggregator {
    uint8   public decimals;
    int256  private _answer;
    uint256 private _updatedAt;

    constructor(uint8 _decimals, int256 initialAnswer) {
        decimals   = _decimals;
        _answer    = initialAnswer;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        )
    {
        return (1, _answer, _updatedAt, _updatedAt, 1);
    }

    function updateAnswer(int256 newAnswer) external {
        _answer    = newAnswer;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 ts) external {
        _updatedAt = ts;
    }
}
