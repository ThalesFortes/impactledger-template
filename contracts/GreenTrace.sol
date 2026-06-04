// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ImpactToken.sol";


interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );
}
contract GreenTrace is Ownable, ERC721, ReentrancyGuard {
    using Strings for uint256;
    using Strings for address;

    // ─── Estruturas ──────────────────────────────────────────────────────────

    struct FundPool {
        uint256 id;
        string  name;
        string  category;
        uint256 totalAmount;
        uint256 spentAmount;
        bool    active;
        uint256 createdAt;
    }

    struct Expenditure {
        uint256 id;
        uint256 poolId;
        string  description;
        uint256 amount;
        uint256 fiatAmountCents;
        string  fiatCurrency;
        address beneficiary;
        string  ipfsHash;
        bool    confirmedByBeneficiary;
        uint256 timestamp;
        uint256 certificateTokenId;
        uint256 confirmedAt;
    }

    struct ImpactReport {
        uint256 expenditureId;
        uint256 beneficiariesCount;
        string  metric;
        uint256 metricValue;
        uint256 metricGoal;
        string  location;
        uint256 reportedAt;
    }

    // ─── Estado ───────────────────────────────────────────────────────────────

    uint256 private _poolCounter;
    uint256 private _expenditureCounter;
    uint256 private _tokenCounter;
    uint256 private _totalBeneficiaries;
    uint256 private _totalAllocated; // acumulador O(1) para getStats
    uint256 private _totalSpent;     // acumulador O(1) para getStats

    address private _auditor;
    address private _governance;

    ImpactToken           private _token;
    AggregatorV3Interface private _priceFeed;

    mapping(uint256 => FundPool)      private _pools;
    mapping(uint256 => Expenditure)   private _expenditures;
    mapping(uint256 => ImpactReport)  private _impactReports;
    mapping(uint256 => bool)          private _auditValidated;
    mapping(uint256 => uint256[])     private _poolExpenditures;
    mapping(uint256 => uint256)       private _tokenToExpenditure;
    mapping(bytes32  => bool)         private _usedPoolNames;
    mapping(uint256  => uint256)      private _pendingReceipts;

    uint256[] private _poolIds;
    uint256[] private _expenditureIds;

    
    uint256 public constant ORACLE_TOLERANCE_PERCENT = 30;
    uint256 public constant ORACLE_STALENESS_THRESHOLD = 1 hours;

    // ─── Eventos ──────────────────────────────────────────────────────────────

    event PoolCreated(uint256 indexed id, string name, string category, uint256 totalAmount, uint256 timestamp);
    event PoolDeactivated(uint256 indexed id, uint256 timestamp);

    event ExpenditureRegistered(
        uint256 indexed id,
        uint256 indexed poolId,
        string  description,
        uint256 amount,
        address indexed beneficiary,
        string  ipfsHash,
        uint256 fiatAmountCents,
        string  fiatCurrency,
        uint256 timestamp
    );

    event ReceiptConfirmed(uint256 indexed expenditureId, address indexed beneficiary, uint256 timestamp);
    event CertificateIssued(uint256 indexed expenditureId, uint256 indexed tokenId, address indexed recipient);
    event ImpactReported(uint256 indexed expenditureId, uint256 beneficiariesCount, string metric, uint256 metricValue, uint256 metricGoal, string location, uint256 timestamp);

    event AuditorSet(address indexed auditor);
    event ExpenditureValidated(uint256 indexed expenditureId, address indexed auditor, uint256 timestamp);

    event GovernanceSet(address indexed governance);
    event PriceFeedSet(address indexed priceFeed);
    event TokenSet(address indexed token);

    /// @notice Inicializa o contrato como owner e define o nome/símbolo do NFT certificado.
    constructor() Ownable(msg.sender) ERC721("GreenTrace Certificate", "GTCERT") {}

    /// @notice Define o contrato ImpactToken usado para mintar tokens de governança ao confirmar recebimento.
    function setToken(address token_) external onlyOwner {
        require(token_ != address(0), "Token invalido");
        _token = ImpactToken(token_);
        emit TokenSet(token_);
    }

    /// @notice Define o oracle Chainlink para validação opcional do valor em USD declarado nos gastos.
    function setPriceFeed(address priceFeed_) external onlyOwner {
        _priceFeed = AggregatorV3Interface(priceFeed_);
        emit PriceFeedSet(priceFeed_);
    }

    /// @notice Define o contrato de governança DAO autorizado a trocar o auditor via votação.
    function setGovernance(address governance_) external onlyOwner {
        require(governance_ != address(0), "Governanca invalida");
        _governance = governance_;
        emit GovernanceSet(governance_);
    }

    /// @notice Define o endereço do auditor externo. Quando configurado, gastos só podem ser confirmados após validação do auditor.
    function setAuditor(address auditor_) external onlyOwner {
        require(auditor_ != address(0), "Auditor invalido");
        _auditor = auditor_;
        emit AuditorSet(auditor_);
    }


    /// @notice Remove o auditor, tornando a etapa de auditoria opcional para novos gastos.
    function removeAuditor() external onlyOwner {
        _auditor = address(0);
        emit AuditorSet(address(0));
    }


    /// @notice Permite à governança DAO trocar o auditor após aprovação de proposta em votação.
    function setAuditorByGovernance(address auditor_) external {
        require(msg.sender == _governance, "Apenas a governanca");
        require(auditor_ != address(0),    "Auditor invalido");
        _auditor = auditor_;
        emit AuditorSet(auditor_);
    }



    /// @notice Cria um novo fundo de impacto social com nome único, categoria e valor total alocado.
    /// @param poolName Nome do fundo (deve ser único).
    /// @param category Categoria do impacto (ex: Educação, Saúde).
    /// @param totalAmount Valor total alocado em wei.
    function createPool(
        string calldata poolName,
        string calldata category,
        uint256 totalAmount
    ) external onlyOwner returns (uint256) {
        require(bytes(poolName).length > 0,  "Nome obrigatorio");
        require(bytes(category).length > 0,  "Categoria obrigatoria");
        require(totalAmount > 0,             "Valor deve ser maior que zero");
        bytes32 nameHash = keccak256(bytes(poolName));
        require(!_usedPoolNames[nameHash],   "Nome de fundo ja utilizado");

        _poolCounter++;
        uint256 poolId = _poolCounter;

        _usedPoolNames[nameHash] = true;
        _pools[poolId] = FundPool({
            id: poolId, name: poolName, category: category,
            totalAmount: totalAmount, spentAmount: 0,
            active: true, createdAt: block.timestamp
        });

        _poolIds.push(poolId);
        _totalAllocated += totalAmount;
        emit PoolCreated(poolId, poolName, category, totalAmount, block.timestamp);
        return poolId;
    }

    /// @notice Encerra um fundo, impedindo novos gastos. Só é possível se não houver recibos pendentes de confirmação.
    function deactivatePool(uint256 poolId) external onlyOwner {
        require(_pools[poolId].id != 0,           "Fundo nao existe");
        require(_pools[poolId].active,             "Fundo ja inativo");
        require(_pendingReceipts[poolId] == 0,     "Fundo tem recibos pendentes");
        _pools[poolId].active = false;
        emit PoolDeactivated(poolId, block.timestamp);
    }


    /// @notice Registra um gasto vinculado a um fundo, com evidência no IPFS e valor equivalente em moeda fiat.
    /// @param poolId ID do fundo ao qual o gasto pertence.
    /// @param description Descrição da ação de impacto realizada.
    /// @param amount Valor gasto em wei.
    /// @param beneficiary Endereço da carteira do beneficiário que confirma o recebimento.
    /// @param ipfsHash CID do comprovante (nota fiscal, foto, documento) armazenado no IPFS.
    /// @param fiatAmountCents Valor equivalente em centavos da moeda fiat (0 se não informado).
    /// @param fiatCurrency Código da moeda fiat (ex: BRL, USD).
    function registerExpenditure(
        uint256 poolId,
        string calldata description,
        uint256 amount,
        address beneficiary,
        string calldata ipfsHash,
        uint256 fiatAmountCents,
        string calldata fiatCurrency
    ) external onlyOwner returns (uint256) {
        require(_pools[poolId].id != 0,              "Fundo nao existe");
        require(_pools[poolId].active,               "Fundo inativo");
        require(bytes(description).length > 0,       "Descricao obrigatoria");
        require(amount > 0,                          "Valor deve ser maior que zero");
        require(beneficiary != address(0),           "Beneficiario invalido");
        require(
            _pools[poolId].spentAmount + amount <= _pools[poolId].totalAmount,
            "Gasto ultrapassa o total do fundo"
        );

        if (
            fiatAmountCents > 0 &&
            keccak256(bytes(fiatCurrency)) == keccak256(bytes("USD")) &&
            address(_priceFeed) != address(0)
        ) {
            _validateFiatUSD(amount, fiatAmountCents);
        }

        _expenditureCounter++;
        uint256 expenditureId = _expenditureCounter;

        _expenditures[expenditureId] = Expenditure({
            id: expenditureId, poolId: poolId,
            description: description, amount: amount,
            fiatAmountCents: fiatAmountCents, fiatCurrency: fiatCurrency,
            beneficiary: beneficiary, ipfsHash: ipfsHash,
            confirmedByBeneficiary: false, timestamp: block.timestamp,
            certificateTokenId: 0, confirmedAt: 0
        });

        _pools[poolId].spentAmount += amount;
        _pendingReceipts[poolId]++;
        _totalSpent += amount;
        _poolExpenditures[poolId].push(expenditureId);
        _expenditureIds.push(expenditureId);

        emit ExpenditureRegistered(
            expenditureId, poolId, description, amount,
            beneficiary, ipfsHash, fiatAmountCents, fiatCurrency, block.timestamp
        );

        return expenditureId;
    }


    /// @notice Chamado pelo beneficiário para confirmar o recebimento do recurso. Emite automaticamente um NFT-certificado on-chain.
    /// @dev Protegido com ReentrancyGuard pois realiza mint de tokens após atualizar o estado.
    function confirmReceipt(uint256 expenditureId) external nonReentrant {
        Expenditure storage exp = _expenditures[expenditureId];
        require(exp.id != 0,                               "Gasto nao existe");
        require(exp.beneficiary == msg.sender,             "Apenas o beneficiario pode confirmar");
        require(!exp.confirmedByBeneficiary,               "Ja confirmado");
        require(
            _auditor == address(0) || _auditValidated[expenditureId],
            "Aguardando validacao do auditor"
        );

        exp.confirmedByBeneficiary = true;
        exp.confirmedAt = block.timestamp;
        if (_pendingReceipts[exp.poolId] > 0) _pendingReceipts[exp.poolId]--;

        _tokenCounter++;
        uint256 tokenId = _tokenCounter;
        exp.certificateTokenId = tokenId;
        _tokenToExpenditure[tokenId] = expenditureId;

        _mint(msg.sender, tokenId);

        if (address(_token) != address(0)) {
            uint256 impactAmount = exp.amount / (10 ** 15); // 1e15 wei = 1 IMPACT unit
            if (impactAmount > 0) {
                _token.mint(msg.sender, impactAmount, "confirmacao de recebimento");
            }
        }

        emit ReceiptConfirmed(expenditureId, msg.sender, block.timestamp);
        emit CertificateIssued(expenditureId, tokenId, msg.sender);
    }

    /// @notice Registra as métricas de impacto de um gasto: número de beneficiados, indicador quantitativo e alinhamento com ODS.
    /// @param expenditureId ID do gasto ao qual o relatório de impacto pertence.
    /// @param beneficiariesCount Número total de pessoas beneficiadas pela ação.
    /// @param metric Nome do indicador medido (ex: "refeições servidas", "famílias atendidas").
    /// @param metricValue Valor alcançado na métrica.
    /// @param metricGoal Meta estabelecida para a métrica.
    /// @param location Localidade onde a ação foi executada.
    function registerImpact(
        uint256 expenditureId,
        uint256 beneficiariesCount,
        string calldata metric,
        uint256 metricValue,
        uint256 metricGoal,
        string calldata location
    ) external onlyOwner {
        require(_expenditures[expenditureId].id != 0,     "Gasto nao existe");
        require(_pools[_expenditures[expenditureId].poolId].active, "Fundo inativo");
        require(_impactReports[expenditureId].reportedAt == 0, "Impacto ja registrado");
        require(beneficiariesCount > 0,                   "Informe ao menos 1 beneficiado");

        _impactReports[expenditureId] = ImpactReport({
            expenditureId: expenditureId,
            beneficiariesCount: beneficiariesCount,
            metric: metric, metricValue: metricValue,
            metricGoal: metricGoal, location: location,
            reportedAt: block.timestamp
        });

        _totalBeneficiaries += beneficiariesCount;

        emit ImpactReported(
            expenditureId, beneficiariesCount, metric,
            metricValue, metricGoal, location, block.timestamp
        );
    }

    /// @notice Chamado pelo auditor externo para validar um gasto antes que o beneficiário possa confirmá-lo.
    function validateExpenditure(uint256 expenditureId) external {
        require(msg.sender == _auditor,                     "Apenas o auditor");
        require(_expenditures[expenditureId].id != 0,      "Gasto nao existe");
        require(!_auditValidated[expenditureId],            "Ja validado pelo auditor");
        _auditValidated[expenditureId] = true;
        emit ExpenditureValidated(expenditureId, msg.sender, block.timestamp);
    }

    // ─── Leitura ──────────────────────────────────────────────────────────────

    function getPool(uint256 poolId) external view returns (FundPool memory) {
        require(_pools[poolId].id != 0, "Fundo nao existe");
        return _pools[poolId];
    }


    function getPools(uint256 offset, uint256 limit)
        external view
        returns (FundPool[] memory result, uint256 total)
    {
        total = _poolIds.length;
        if (offset >= total) return (new FundPool[](0), total);
        uint256 end = (limit == 0 || offset + limit > total) ? total : offset + limit;
        result = new FundPool[](end - offset);
        for (uint256 i = offset; i < end; i++) result[i - offset] = _pools[_poolIds[i]];
    }

    function getPoolCount() external view returns (uint256) {
        return _poolIds.length;
    }


    function getExpendituresByPool(uint256 poolId, uint256 offset, uint256 limit)
        external view
        returns (Expenditure[] memory result, uint256 total)
    {
        uint256[] storage ids = _poolExpenditures[poolId];
        total = ids.length;
        if (offset >= total) return (new Expenditure[](0), total);
        uint256 end = (limit == 0 || offset + limit > total) ? total : offset + limit;
        result = new Expenditure[](end - offset);
        for (uint256 i = offset; i < end; i++) result[i - offset] = _expenditures[ids[i]];
    }

    function getExpenditureCountByPool(uint256 poolId) external view returns (uint256) {
        return _poolExpenditures[poolId].length;
    }

    function getExpenditure(uint256 expenditureId) external view returns (Expenditure memory) {
        require(_expenditures[expenditureId].id != 0, "Gasto nao existe");
        return _expenditures[expenditureId];
    }

    function getRecentExpenditures(uint256 limit) external view returns (Expenditure[] memory) {
        uint256 total = _expenditureIds.length;
        uint256 count = limit > total ? total : limit;
        Expenditure[] memory result = new Expenditure[](count);
        for (uint256 i = 0; i < count; i++) result[i] = _expenditures[_expenditureIds[total - 1 - i]];
        return result;
    }

    function getImpactReport(uint256 expenditureId) external view returns (ImpactReport memory) {
        return _impactReports[expenditureId];
    }

    /// @notice Retorna estatísticas globais da plataforma: total alocado, gasto, número de fundos, gastos e beneficiários.
    function getStats() external view returns (
        uint256 totalAllocated,
        uint256 totalSpent,
        uint256 poolCount,
        uint256 expenditureCount,
        uint256 totalBeneficiaries
    ) {
        totalAllocated     = _totalAllocated;
        totalSpent         = _totalSpent;
        poolCount          = _poolIds.length;
        expenditureCount   = _expenditureIds.length;
        totalBeneficiaries = _totalBeneficiaries;
    }

    function getAuditor()   external view returns (address) { return _auditor; }
    function getGovernance() external view returns (address) { return _governance; }
    function getToken()      external view returns (address) { return address(_token); }
    function getPriceFeed()  external view returns (address) { return address(_priceFeed); }

    function isAuditValidated(uint256 expenditureId) external view returns (bool) {
        return _auditValidated[expenditureId];
    }

    function totalCertificates() external view returns (uint256) { return _tokenCounter; }


    /// @notice Retorna os metadados do NFT-certificado como JSON Base64 com SVG gerado inteiramente on-chain — sem dependência de servidor externo.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_tokenToExpenditure[tokenId] != 0, "Token inexistente");

        uint256 expenditureId = _tokenToExpenditure[tokenId];
        Expenditure memory exp = _expenditures[expenditureId];
        FundPool    memory pool = _pools[exp.poolId];

        string memory amountEth = _weiToEthString(exp.amount);

        string memory poolNameSafe  = _xmlEscape(_truncate(pool.name,    36));
        string memory categorySafe  = _xmlEscape(_truncate(pool.category, 10));
        string memory descSafe      = _xmlEscape(_truncate(exp.description, 40));

        string memory svg = _buildSVG(tokenId, poolNameSafe, categorySafe, descSafe, amountEth, exp.beneficiary);

        string memory extraAttrs = string(abi.encodePacked(
            ',{"trait_type":"Beneficiario","value":"', exp.beneficiary.toHexString(), '"}'
        ));
        if (exp.fiatAmountCents > 0 && bytes(exp.fiatCurrency).length > 0) {
            extraAttrs = string(abi.encodePacked(
                extraAttrs,
                ',{"trait_type":"Valor Fiat","value":"', _fiatToString(exp.fiatAmountCents, exp.fiatCurrency), '"}'
            ));
        }
        if (bytes(exp.ipfsHash).length > 0) {
            extraAttrs = string(abi.encodePacked(
                extraAttrs,
                ',{"trait_type":"Comprovante IPFS","value":"', _jsonEscape(exp.ipfsHash), '"}'
            ));
        }

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"GreenTrace Certificate #', tokenId.toString(), '",',
            '"description":"Certificado de recebimento de fundo de impacto social. Emitido automaticamente pelo contrato GreenTrace na blockchain Sepolia.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
                '{"trait_type":"Fundo","value":"',      _jsonEscape(pool.name),           '"},',
                '{"trait_type":"Categoria","value":"',  _jsonEscape(pool.category),       '"},',
                '{"trait_type":"Descricao","value":"',  _jsonEscape(exp.description),     '"},',
                '{"trait_type":"Valor ETH","value":"',  amountEth,                        '"},',
                '{"trait_type":"Gasto ID","value":"',   expenditureId.toString(),         '"},',
                '{"trait_type":"Confirmado em","value":"', exp.confirmedAt.toString(),    '"}',
                extraAttrs,
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }


    function _validateFiatUSD(uint256 weiAmount, uint256 fiatCents) internal view {
        (, int256 price, , uint256 updatedAt, ) = _priceFeed.latestRoundData();
        require(price > 0,     "Oraculo: preco invalido");
        require(updatedAt > 0, "Oraculo: round incompleto");
        require(
            block.timestamp - updatedAt <= ORACLE_STALENESS_THRESHOLD,
            "Oraculo: dados desatualizados"
        );

  
        require(fiatCents <= type(uint128).max, "Oraculo: fiatCents fora do intervalo");

        uint256 weiXprice   = weiAmount * uint256(price);
        uint256 scaledFiat  = fiatCents * (10 ** 24) * 100;

        require(
            scaledFiat >= weiXprice * (100 - ORACLE_TOLERANCE_PERCENT) &&
            scaledFiat <= weiXprice * (100 + ORACLE_TOLERANCE_PERCENT),
            "Oraculo: valor ETH diverge do USD declarado (+/-30%)"
        );
    }

    function _buildSVG(
        uint256 tokenId,
        string memory poolName,   
        string memory category,   
        string memory description, 
        string memory amountEth,
        address beneficiary_
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">',
            '<rect width="400" height="240" rx="16" fill="#111827"/>',
            '<rect width="400" height="6" rx="3" fill="#10b981"/>',
            '<text x="24" y="38" font-family="monospace" font-size="18" font-weight="bold" fill="#10b981">Green</text>',
            '<text x="93" y="38" font-family="monospace" font-size="18" font-weight="bold" fill="white">Trace</text>',
            '<text x="24" y="56" font-family="monospace" font-size="9" fill="#6b7280">CERTIFICADO DE RECEBIMENTO</text>',
            '<text x="376" y="38" font-family="monospace" font-size="10" fill="#6b7280" text-anchor="end">#', tokenId.toString(), '</text>',
            '<rect x="24" y="72" width="352" height="1" fill="#1f2937"/>',
            '<text x="24" y="100" font-family="monospace" font-size="11" fill="#9ca3af">FUNDO</text>',
            '<text x="24" y="116" font-family="monospace" font-size="13" fill="white">', poolName, '</text>',
            '<text x="24" y="144" font-family="monospace" font-size="11" fill="#9ca3af">DESCRICAO</text>',
            '<text x="24" y="160" font-family="monospace" font-size="12" fill="white">', description, '</text>',
            '<rect x="24" y="178" width="352" height="1" fill="#1f2937"/>',
            '<text x="24" y="202" font-family="monospace" font-size="11" fill="#9ca3af">BENEFICIARIO</text>',
            '<text x="24" y="218" font-family="monospace" font-size="11" fill="#d1d5db">', _abbreviateAddress(beneficiary_), '</text>',
            '<text x="376" y="202" font-family="monospace" font-size="11" fill="#9ca3af" text-anchor="end">VALOR (', category, ')</text>',
            '<text x="376" y="218" font-family="monospace" font-size="14" font-weight="bold" fill="#10b981" text-anchor="end">', amountEth, ' ETH</text>',
            '</svg>'
        ));
    }


    function _xmlEscape(string memory s) internal pure returns (string memory) {
        bytes memory src = bytes(s);
        uint256 extra = 0;
        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if      (c == 0x26) extra += 4; 
            else if (c == 0x3c) extra += 3; 
            else if (c == 0x3e) extra += 3; 
            else if (c == 0x22) extra += 5; 
            else if (c == 0x27) extra += 5; 
        }
        if (extra == 0) return s;

        bytes memory dst = new bytes(src.length + extra);
        uint256 j = 0;
        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == 0x26) {
                dst[j++]=0x26; dst[j++]=0x61; dst[j++]=0x6d; dst[j++]=0x70; dst[j++]=0x3b; // &amp;
            } else if (c == 0x3c) {
                dst[j++]=0x26; dst[j++]=0x6c; dst[j++]=0x74; dst[j++]=0x3b; // &lt;
            } else if (c == 0x3e) {
                dst[j++]=0x26; dst[j++]=0x67; dst[j++]=0x74; dst[j++]=0x3b; // &gt;
            } else if (c == 0x22) {
                dst[j++]=0x26; dst[j++]=0x71; dst[j++]=0x75; dst[j++]=0x6f; dst[j++]=0x74; dst[j++]=0x3b; // &quot;
            } else if (c == 0x27) {
                dst[j++]=0x26; dst[j++]=0x61; dst[j++]=0x70; dst[j++]=0x6f; dst[j++]=0x73; dst[j++]=0x3b; // &apos;
            } else {
                dst[j++] = c;
            }
        }
        return string(dst);
    }


    function _jsonEscape(string memory s) internal pure returns (string memory) {
        bytes memory src = bytes(s);
        uint256 extra = 0;
        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == 0x22 || c == 0x5c) extra += 1;       
            else if (c == 0x0a || c == 0x0d || c == 0x09) extra += 1; 
            else if (c <= 0x1f) extra -= 1;                 
        }
        if (extra == 0) {
            bool hasControl = false;
            for (uint256 i = 0; i < src.length; i++) {
                if (src[i] <= 0x1f && src[i] != 0x09 && src[i] != 0x0a && src[i] != 0x0d) {
                    hasControl = true; break;
                }
            }
            if (!hasControl) return s;
        }

        bytes memory dst = new bytes(src.length + extra);
        uint256 j = 0;
        for (uint256 i = 0; i < src.length; i++) {
            bytes1 c = src[i];
            if (c == 0x22) { dst[j++] = 0x5c; dst[j++] = 0x22; }     
            else if (c == 0x5c) { dst[j++] = 0x5c; dst[j++] = 0x5c; }  
            else if (c == 0x0a) { dst[j++] = 0x5c; dst[j++] = 0x6e; }  
            else if (c == 0x0d) { dst[j++] = 0x5c; dst[j++] = 0x72; }  
            else if (c == 0x09) { dst[j++] = 0x5c; dst[j++] = 0x74; }  
            else if (c <= 0x1f) { /* descarta */ }
            else { dst[j++] = c; }
        }
        bytes memory trimmed = new bytes(j);
        for (uint256 i = 0; i < j; i++) trimmed[i] = dst[i];
        return string(trimmed);
    }

    function _abbreviateAddress(address addr) internal pure returns (string memory) {
        string memory full = addr.toHexString();
        bytes memory b = bytes(full);
        bytes memory result = new bytes(13);
        for (uint256 i = 0; i < 6; i++) result[i] = b[i];
        result[6] = "."; result[7] = "."; result[8] = ".";
        result[9] = b[38]; result[10] = b[39]; result[11] = b[40]; result[12] = b[41];
        return string(result);
    }

    function _fiatToString(uint256 cents, string memory currency) internal pure returns (string memory) {
        uint256 units     = cents / 100;
        uint256 remainder = cents % 100;
        string memory remStr = remainder < 10
            ? string(abi.encodePacked("0", remainder.toString()))
            : remainder.toString();
        return string(abi.encodePacked(units.toString(), ".", remStr, " ", _jsonEscape(currency)));
    }

    function _weiToEthString(uint256 wei_) internal pure returns (string memory) {
        uint256 eth      = wei_ / 1e18;
        uint256 decimals_ = (wei_ % 1e18) / 1e14;
        return string(abi.encodePacked(eth.toString(), ".", _padLeft(decimals_, 4)));
    }

    function _truncate(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length <= maxLen) return s;
        bytes memory result = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen - 3; i++) result[i] = b[i];
        result[maxLen - 3] = "."; result[maxLen - 2] = "."; result[maxLen - 1] = ".";
        return string(result);
    }

    function _padLeft(uint256 n, uint256 digits) internal pure returns (string memory) {
        string memory s = n.toString();
        bytes memory b  = bytes(s);
        if (b.length >= digits) return s;
        bytes memory padded = new bytes(digits);
        uint256 pad = digits - b.length;
        for (uint256 i = 0; i < pad; i++) padded[i] = "0";
        for (uint256 i = 0; i < b.length; i++) padded[pad + i] = b[i];
        return string(padded);
    }
}
