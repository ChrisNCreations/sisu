// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd
/// @notice Pure inventory-risk math. Values are 1e18 USD. Ratios are 1e9 (1e9 = 100%).
library SisuRiskMath {
    uint256 internal constant ONE = 1e9;

    error ZeroMaxRisk();
    error InvalidPrice();

    /// @dev Convert a token amount and aggregator price into 1e18 USD.
    function valueUsd(
        uint256 amount,
        uint256 price,
        uint8 tokenDecimals,
        uint8 priceDecimals
    ) internal pure returns (uint256) {
        if (price == 0) {
            revert InvalidPrice();
        }
        uint256 scaled = amount * price;
        uint256 priceScale = 10 ** uint256(priceDecimals);
        if (tokenDecimals <= 18) {
            return scaled * (10 ** uint256(18 - tokenDecimals)) / priceScale;
        }
        return scaled / (10 ** uint256(tokenDecimals - 18)) / priceScale;
    }

    /// @dev USDC (6 decimals) treated as $1.
    function valueUsdcUsd(uint256 amountUsdc) internal pure returns (uint256) {
        return amountUsdc * 1e12;
    }

    /// @dev Risk = |A-B|/(A+B) in 1e9. Zero inventory is zero risk.
    function risk(uint256 valueA, uint256 valueB) internal pure returns (uint256) {
        uint256 total = valueA + valueB;
        if (total == 0) {
            return 0;
        }
        uint256 diff = valueA > valueB ? valueA - valueB : valueB - valueA;
        return diff * ONE / total;
    }

    /// @dev r = Risk / maxRisk in 1e9. Capped at ONE.
    function normalizedRisk(uint256 riskBps, uint256 maxRiskBps) internal pure returns (uint256) {
        if (maxRiskBps == 0) {
            revert ZeroMaxRisk();
        }
        uint256 r = riskBps * ONE / maxRiskBps;
        return r > ONE ? ONE : r;
    }

    /// @dev +1 if tokenIn is overweight by value, -1 if underweight, 0 if equal.
    function pressure(uint256 valueTokenIn, uint256 valueTokenOut) internal pure returns (int256) {
        if (valueTokenIn > valueTokenOut) {
            return int256(1);
        }
        if (valueTokenIn < valueTokenOut) {
            return -int256(1);
        }
        return 0;
    }

    /// @dev M = 1 + P·S·r, fee = clamp(baseFee · M, 0, maxFee). Floor 0, no rebate.
    function finalFee(
        uint256 baseFee,
        uint256 maxFee,
        uint256 strength,
        uint256 normalizedRiskBps,
        int256 p
    ) internal pure returns (uint256) {
        uint256 term = strength * normalizedRiskBps / ONE;
        uint256 m;
        if (p >= 0) {
            m = ONE + term;
        } else if (term >= ONE) {
            m = 0;
        } else {
            m = ONE - term;
        }
        uint256 fee = baseFee * m / ONE;
        if (fee > maxFee) {
            return maxFee;
        }
        return fee;
    }

    /// @dev Post-trade risk after adding `valueIn` to the in-side and subtracting `valueOut` from the out-side.
    function postTradeRisk(
        uint256 valueInSide,
        uint256 valueOutSide,
        uint256 valueIn,
        uint256 valueOut
    ) internal pure returns (uint256) {
        if (valueOut > valueOutSide) {
            return ONE;
        }
        return risk(valueInSide + valueIn, valueOutSide - valueOut);
    }

    function exceedsMaxRisk(uint256 postRiskBps, uint256 maxRiskBps) internal pure returns (bool) {
        return postRiskBps > maxRiskBps;
    }
}
