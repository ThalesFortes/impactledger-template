// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ImpactToken.sol";


interface IGreenTrace {
    function setAuditorByGovernance(address auditor) external;
}


contract ImpactGovernance is ReentrancyGuard {
    ImpactToken public immutable token;
    IGreenTrace public immutable ledger;

    uint256 public constant VOTING_PERIOD  = 10 minutes;
    uint256 public constant QUORUM_PERCENT = 5; 

    enum ProposalStatus { Active, Executed, Rejected }

    struct Proposal {
        uint256        id;
        address        proposer;
        address        targetAuditor;
        string         description;
        uint256        votesFor;
        uint256        votesAgainst;
        uint256        deadline;
        uint256        totalSupplyAtCreation; 
        uint256        snapshotBlock;       
        ProposalStatus status;
    }

    uint256    private _proposalCounter;
    uint256[]  private _proposalIds;
    mapping(uint256 => Proposal)                 private _proposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address         targetAuditor,
        string          description,
        uint256         deadline,
        uint256         totalSupplyAtCreation,
        uint256         snapshotBlock
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool            support,
        uint256         weight
    );
    event ProposalExecuted(uint256 indexed proposalId, address indexed newAuditor);
    event ProposalRejected(uint256 indexed proposalId);

    constructor(address tokenAddr, address ledgerAddr) {
        require(tokenAddr  != address(0), "Token invalido");
        require(ledgerAddr != address(0), "Ledger invalido");
        token  = ImpactToken(tokenAddr);
        ledger = IGreenTrace(ledgerAddr);
    }

   
    function propose(
        address targetAuditor,
        string calldata description
    ) external nonReentrant returns (uint256) {
        require(token.balanceOf(msg.sender) > 0, "Sem tokens de governanca");
        require(targetAuditor != address(0),      "Auditor invalido");
        require(bytes(description).length > 0,    "Descricao obrigatoria");

        uint256 supplySnapshot = token.totalSupply();

        uint256 snapshot = block.number - 1;

        _proposalCounter++;
        uint256 id = _proposalCounter;

        _proposals[id] = Proposal({
            id:                   id,
            proposer:             msg.sender,
            targetAuditor:        targetAuditor,
            description:          description,
            votesFor:             0,
            votesAgainst:         0,
            deadline:             block.timestamp + VOTING_PERIOD,
            totalSupplyAtCreation: supplySnapshot,
            snapshotBlock:        snapshot,
            status:               ProposalStatus.Active
        });

        _proposalIds.push(id);
        emit ProposalCreated(id, msg.sender, targetAuditor, description, _proposals[id].deadline, supplySnapshot, snapshot);
        return id;
    }


    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage p = _proposals[proposalId];

        // ── Checks ───────────────────────────────────────────────────────────
        require(p.id != 0,                         "Proposta inexistente");
        require(p.status == ProposalStatus.Active,  "Votacao ja encerrada");
        require(block.timestamp <= p.deadline,       "Prazo de votacao encerrado");
        require(!_hasVoted[proposalId][msg.sender],  "Ja votou nesta proposta");


        uint256 weight = token.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "Sem poder de voto no snapshot da proposta");

        _hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.votesFor += weight;
        } else {
            p.votesAgainst += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }


    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage p = _proposals[proposalId];

        // ── Checks ───────────────────────────────────────────────────────────
        require(p.id != 0,                        "Proposta inexistente");
        require(p.status == ProposalStatus.Active, "Ja processada");
        require(block.timestamp > p.deadline,      "Votacao ainda ativa");

        uint256 totalVotes = p.votesFor + p.votesAgainst;
        uint256 quorum     = (p.totalSupplyAtCreation * QUORUM_PERCENT) / 100;
        bool    approved   = totalVotes >= quorum && p.votesFor > p.votesAgainst;

        if (!approved) {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
            return;
        }

        p.status = ProposalStatus.Executed;

        ledger.setAuditorByGovernance(p.targetAuditor);
        emit ProposalExecuted(proposalId, p.targetAuditor);
    }


    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(_proposals[proposalId].id != 0, "Proposta inexistente");
        return _proposals[proposalId];
    }

    function getAllProposals() external view returns (Proposal[] memory) {
        Proposal[] memory result = new Proposal[](_proposalIds.length);
        for (uint256 i = 0; i < _proposalIds.length; i++) {
            result[i] = _proposals[_proposalIds[i]];
        }
        return result;
    }

    function hasVotedOn(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    function proposalCount() external view returns (uint256) {
        return _proposalCounter;
    }
}
