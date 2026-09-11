// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { Context, ContextLib } from "@1inch/swap-vm/src/libs/VM.sol";

import { SisuRiskMath } from "../libraries/SisuRiskMath.sol";
import { SisuOracle } from "../libraries/SisuOracle.sol";
import { SisuValuation } from "../libraries/SisuValuation.sol";

uint256 constant SISU_BPS = 1e9;

library SisuFeeArgsBuilder {
    function build(
        address oracle,
        address ethToken,
        uint32 maxStaleness,
        uint32 maxRisk,
        uint32 baseFee,
        uint32 maxFee,
        uint32 strength
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(oracle, ethToken, maxStaleness, maxRisk, baseFee, maxFee, strength);
    }

    function parse(bytes calldata args)
        internal
        pure
        returns (
            address oracle,
            address ethToken,
            uint32 maxStaleness,
            uint32 maxRisk,
            uint32 baseFee,
            uint32 maxFee,
            uint32 strength
        )
    {
        oracle = address(uint160(bytes20(args[0:20])));
        ethToken = address(uint160(bytes20(args[20:40])));
        maxStaleness = uint32(bytes4(args[40:44]));
        maxRisk = uint32(bytes4(args[44:48]));
        baseFee = uint32(bytes4(args[48:52]));
        maxFee = uint32(bytes4(args[52:56]));
        strength = uint32(bytes4(args[56:60]));
    }
}

contract SisuFee {
    using ContextLib for Context;

    error SisuFeeMustRunBeforeSwap();

    /// @dev Inventory-aware fee, then runLoop() so XYC + SISU_LIMIT see the net amountIn.
    function _sisuFeeXD(Context memory ctx, bytes calldata args) internal {
        require(ctx.swap.amountIn == 0 || ctx.swap.amountOut == 0, SisuFeeMustRunBeforeSwap());

        (
            address oracle,
            address ethToken,
            uint32 maxStaleness,
            uint32 maxRisk,
            uint32 baseFee,
            uint32 maxFee,
            uint32 strength
        ) = SisuFeeArgsBuilder.parse(args);

        (uint256 price, uint8 priceDecimals) = SisuOracle.readPrice(oracle, maxStaleness);

        uint256 valueIn = SisuValuation.sideValue(ctx.query.tokenIn, ctx.swap.balanceIn, ethToken, price, priceDecimals);
        uint256 valueOut = SisuValuation.sideValue(ctx.query.tokenOut, ctx.swap.balanceOut, ethToken, price, priceDecimals);

        uint256 riskBps = SisuRiskMath.risk(valueIn, valueOut);
        uint256 r = SisuRiskMath.normalizedRisk(riskBps, maxRisk);
        int256 p = SisuRiskMath.pressure(valueIn, valueOut);
        uint256 feeBps = SisuRiskMath.finalFee(baseFee, maxFee, strength, r, p);

        if (ctx.query.isExactIn) {
            uint256 takerDefinedAmountIn = ctx.swap.amountIn;
            ctx.swap.amountIn -= Math.ceilDiv(ctx.swap.amountIn * feeBps, SISU_BPS);
            ctx.runLoop();
            ctx.swap.amountIn = takerDefinedAmountIn;
        } else {
            ctx.runLoop();
            if (feeBps >= SISU_BPS) {
                ctx.swap.amountIn = type(uint256).max;
            } else {
                ctx.swap.amountIn += Math.ceilDiv(ctx.swap.amountIn * feeBps, SISU_BPS - feeBps);
            }
        }
    }
}
