// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ImpactNFT {

    struct ImpactRecord {
        string action;
        string participant;
        uint256 timestamp;
    }

    ImpactRecord[] public records;

    function registerImpact(
        string memory _action,
        string memory _participant
    ) public {

        records.push(
            ImpactRecord(
                _action,
                _participant,
                block.timestamp
            )
        );
    }

    function totalRecords() public view returns(uint256) {
        return records.length;
    }
}
