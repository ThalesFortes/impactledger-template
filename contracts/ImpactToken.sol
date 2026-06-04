// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/// @title ImpactToken
/// @notice Token de governança ERC20Votes distribuído automaticamente aos beneficiários que confirmam recebimento de recursos.
/// @dev Usa ERC20Votes para permitir snapshot de votos por bloco, eliminando double voting na governança.
contract ImpactToken is ERC20Votes, Ownable {

    /// @notice Taxa de conversão: 1e15 wei de gasto = 1 unidade de IMPACT token.
    uint256 public constant MINT_RATE = 1_000;

    event TokensMinted(address indexed to, uint256 amount, string reason);

    constructor()
        ERC20("ImpactToken", "IMPACT")
        EIP712("ImpactToken", "1")
        Ownable(msg.sender)
    {}


    /// @notice Minta tokens para um endereço. Chamado exclusivamente pelo contrato GreenTrace ao confirmar um recebimento.
    /// @param to Endereço do beneficiário que receberá os tokens.
    /// @param amount Quantidade de tokens (sem decimais — o contrato aplica os 18 decimais internamente).
    /// @param reason Motivo do mint registrado no evento para auditabilidade.
    function mint(address to, uint256 amount, string calldata reason) external onlyOwner {
        _mint(to, amount * (10 ** decimals()));
        emit TokensMinted(to, amount * (10 ** decimals()), reason);
    }

    /// @notice Sobrescreve _update do ERC20Votes para auto-delegar votos ao receber tokens pela primeira vez.
    /// @dev Sem auto-delegate, o beneficiário precisaria chamar delegate() manualmente para participar da governança.
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
