// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

library SisuOracle {
    error SisuStaleOracle(uint256 updatedAt, uint256 maxStaleness);
    error SisuIncompleteOracleRound(uint80 roundId, uint80 answeredInRound);
    error SisuInvalidOraclePrice(int256 answer);

    function readPrice(address oracle, uint32 maxStaleness)
        internal
        view
        returns (uint256 price, uint8 priceDecimals)
    {
        IAggregatorV3 feed = IAggregatorV3(oracle);
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0) {
            revert SisuInvalidOraclePrice(answer);
        }
        if (answeredInRound < roundId) {
            revert SisuIncompleteOracleRound(roundId, answeredInRound);
        }
        if (updatedAt == 0 || block.timestamp - updatedAt > maxStaleness) {
            revert SisuStaleOracle(updatedAt, maxStaleness);
        }
        return (uint256(answer), feed.decimals());
    }
}
