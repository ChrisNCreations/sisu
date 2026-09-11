// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { Context } from "@1inch/swap-vm/src/libs/VM.sol";

import { SisuRiskMath } from "../libraries/SisuRiskMath.sol";
import { SisuOracle } from "../libraries/SisuOracle.sol";
import { SisuValuation } from "../libraries/SisuValuation.sol";

library SisuLimitArgsBuilder {
    function build(address oracle, address ethToken, uint32 maxStaleness, uint32 maxRisk)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(oracle, ethToken, maxStaleness, maxRisk);
    }

    function parse(bytes calldata args)
        internal
        pure
        returns (address oracle, address ethToken, uint32 maxStaleness, uint32 maxRisk)
    {
        oracle = address(uint160(bytes20(args[0:20])));
        ethToken = address(uint160(bytes20(args[20:40])));
        maxStaleness = uint32(bytes4(args[40:44]));
        maxRisk = uint32(bytes4(args[44:48]));
    }
}

contract SisuLimit {
    error SisuRiskLimitExceeded(uint256 postRiskBps, uint256 maxRiskBps);

    /// @dev Must run after XYC so amountOut is known. Reverts if RiskPost > maxRisk. Equality is allowed.
    function _sisuLimitXD(Context memory ctx, bytes calldata args) internal view {
        (address oracle, address ethToken, uint32 maxStaleness, uint32 maxRisk) = SisuLimitArgsBuilder.parse(args);
        (uint256 price, uint8 priceDecimals) = SisuOracle.readPrice(oracle, maxStaleness);

        uint256 valueInSide = SisuValuation.sideValue(ctx.query.tokenIn, ctx.swap.balanceIn, ethToken, price, priceDecimals);
        uint256 valueOutSide = SisuValuation.sideValue(ctx.query.tokenOut, ctx.swap.balanceOut, ethToken, price, priceDecimals);
        uint256 valueIn = SisuValuation.sideValue(ctx.query.tokenIn, ctx.swap.amountIn, ethToken, price, priceDecimals);
        uint256 valueOut = SisuValuation.sideValue(ctx.query.tokenOut, ctx.swap.amountOut, ethToken, price, priceDecimals);

        uint256 postRiskBps = SisuRiskMath.postTradeRisk(valueInSide, valueOutSide, valueIn, valueOut);
        if (postRiskBps > maxRisk) {
            revert SisuRiskLimitExceeded(postRiskBps, maxRisk);
        }
    }
}
