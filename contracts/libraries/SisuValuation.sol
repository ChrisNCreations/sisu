// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { SisuRiskMath } from "./SisuRiskMath.sol";

library SisuValuation {
    function sideValue(
        address token,
        uint256 amount,
        address ethToken,
        uint256 ethUsdPrice,
        uint8 priceDecimals
    ) internal view returns (uint256) {
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        if (token == ethToken) {
            return SisuRiskMath.valueUsd(amount, ethUsdPrice, tokenDecimals, priceDecimals);
        }
        return SisuRiskMath.valueUsd(amount, 10 ** uint256(priceDecimals), tokenDecimals, priceDecimals);
    }
}
