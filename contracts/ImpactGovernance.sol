// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ImpactToken.sol";


interface IGreenTrace {
    function setAuditorByGovernance(address auditor) external;
}


/// @title ImpactGovernance
/// @notice DAO que permite aos holders de ImpactToken propor e votar na troca do auditor externo do GreenTrace.
/// @dev Votos são ponderados por tokens no bloco anterior à criação da proposta (snapshot), prevenindo double voting.
contract ImpactGovernance is ReentrancyGuard {
    ImpactToken public immutable token;
    IGreenTrace public immutable ledger;

    /// @notice Período de votação de cada proposta.
    uint256 public constant VOTING_PERIOD  = 10 minutes;

    /// @notice Quórum mínimo: 5% do total de tokens em circulação devem votar para a proposta ser válida.
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
        uint256        totalSupplyAtCreation; // snapshot do supply para cálculo de quórum
        uint256        snapshotBlock;         // bloco de referência para leitura de votos (getPastVotes)
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

    /// @notice Inicializa a governança com o token de votos e o contrato GreenTrace que será governado.
    constructor(address tokenAddr, address ledgerAddr) {
        require(tokenAddr  != address(0), "Token invalido");
        require(ledgerAddr != address(0), "Ledger invalido");
        token  = ImpactToken(tokenAddr);
        ledger = IGreenTrace(ledgerAddr);
    }

    /// @notice Cria uma proposta para trocar o auditor externo do GreenTrace. Requer ao menos 1 token de governança.
    /// @param targetAuditor Endereço do novo auditor proposto.
    /// @param description Justificativa da proposta exibida para os votantes.
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


    /// @notice Registra o voto de um holder. O peso do voto é baseado no saldo do bloco de snapshot da proposta.
    /// @param proposalId ID da proposta a ser votada.
    /// @param support true para votar a favor, false para votar contra.
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


    /// @notice Executa a proposta após o prazo de votação. Se aprovada, troca o auditor no GreenTrace via governança.
    /// @dev A proposta é aprovada se atingiu quórum (5% do supply) e votos a favor superam os contra.
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


    /// @notice Retorna os dados completos de uma proposta pelo ID.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(_proposals[proposalId].id != 0, "Proposta inexistente");
        return _proposals[proposalId];
    }

    /// @notice Retorna todas as propostas criadas, em ordem de criação.
    function getAllProposals() external view returns (Proposal[] memory) {
        Proposal[] memory result = new Proposal[](_proposalIds.length);
        for (uint256 i = 0; i < _proposalIds.length; i++) {
            result[i] = _proposals[_proposalIds[i]];
        }
        return result;
    }

    /// @notice Verifica se um endereço já votou em uma proposta específica.
    function hasVotedOn(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    /// @notice Retorna o número total de propostas criadas.
    function proposalCount() external view returns (uint256) {
        return _proposalCounter;
    }
}
