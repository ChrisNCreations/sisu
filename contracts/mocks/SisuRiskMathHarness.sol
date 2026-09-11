// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { SisuRiskMath } from "../libraries/SisuRiskMath.sol";

contract SisuRiskMathHarness {
    // Same selectors as SisuRiskMath so Hardhat can match library reverts.
    error InvalidPrice();
    error ZeroMaxRisk();

    function valueUsd(
        uint256 amount,
        uint256 price,
        uint8 tokenDecimals,
        uint8 priceDecimals
    ) external pure returns (uint256) {
        return SisuRiskMath.valueUsd(amount, price, tokenDecimals, priceDecimals);
    }

    function valueUsdcUsd(uint256 amountUsdc) external pure returns (uint256) {
        return SisuRiskMath.valueUsdcUsd(amountUsdc);
    }

    function risk(uint256 valueA, uint256 valueB) external pure returns (uint256) {
        return SisuRiskMath.risk(valueA, valueB);
    }

    function normalizedRisk(uint256 riskBps, uint256 maxRiskBps) external pure returns (uint256) {
        return SisuRiskMath.normalizedRisk(riskBps, maxRiskBps);
    }

    function pressure(uint256 valueTokenIn, uint256 valueTokenOut) external pure returns (int256) {
        return SisuRiskMath.pressure(valueTokenIn, valueTokenOut);
    }

    function finalFee(
        uint256 baseFee,
        uint256 maxFee,
        uint256 strength,
        uint256 normalizedRiskBps,
        int256 p
    ) external pure returns (uint256) {
        return SisuRiskMath.finalFee(baseFee, maxFee, strength, normalizedRiskBps, p);
    }

    function postTradeRisk(
        uint256 valueInSide,
        uint256 valueOutSide,
        uint256 valueIn,
        uint256 valueOut
    ) external pure returns (uint256) {
        return SisuRiskMath.postTradeRisk(valueInSide, valueOutSide, valueIn, valueOut);
    }

    function exceedsMaxRisk(uint256 postRiskBps, uint256 maxRiskBps) external pure returns (bool) {
        return SisuRiskMath.exceedsMaxRisk(postRiskBps, maxRiskBps);
    }
}
