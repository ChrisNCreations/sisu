// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { Context } from "@1inch/swap-vm/src/libs/VM.sol";
import { AquaOpcodes } from "@1inch/swap-vm/src/opcodes/AquaOpcodes.sol";
import { Controls } from "@1inch/swap-vm/src/instructions/Controls.sol";
import { XYCSwap } from "@1inch/swap-vm/src/instructions/XYCSwap.sol";
import { XYCConcentrate } from "@1inch/swap-vm/src/instructions/XYCConcentrate.sol";
import { Decay } from "@1inch/swap-vm/src/instructions/Decay.sol";
import { Fee } from "@1inch/swap-vm/src/instructions/Fee.sol";
import { Extruction } from "@1inch/swap-vm/src/instructions/Extruction.sol";
import { PeggedSwap } from "@1inch/swap-vm/src/instructions/PeggedSwap.sol";

import { SisuFee } from "../instructions/SisuFee.sol";
import { SisuLimit } from "../instructions/SisuLimit.sol";

uint256 constant SISU_FEE_OPCODE = 34;
uint256 constant SISU_LIMIT_OPCODE = 35;

contract SisuOpcodes is AquaOpcodes, SisuFee, SisuLimit {
    // Re-declare library errors so the router ABI can match them.
    error SisuStaleOracle(uint256 updatedAt, uint256 maxStaleness);
    error SisuIncompleteOracleRound(uint80 roundId, uint80 answeredInRound);
    error SisuInvalidOraclePrice(int256 answer);

    constructor(address aqua) AquaOpcodes(aqua) {}

    function _runOpcode(Context memory ctx, uint256 opcode, bytes calldata args) internal virtual override {
        if (opcode == SISU_FEE_OPCODE) {
            SisuFee._sisuFeeXD(ctx, args);
        } else if (opcode == SISU_LIMIT_OPCODE) {
            SisuLimit._sisuLimitXD(ctx, args);
        } else {
            super._runOpcode(ctx, opcode, args);
        }
    }

    function _opcodes()
        internal
        pure
        virtual
        override
        returns (function(Context memory, bytes calldata) internal[] memory result)
    {
        function(Context memory, bytes calldata) internal[37] memory instructions = [
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            Controls._jump,
            Controls._jumpIfTokenIn,
            Controls._jumpIfTokenOut,
            Controls._deadline,
            Controls._onlyTakerTokenBalanceNonZero,
            Controls._onlyTakerTokenBalanceGte,
            Controls._onlyTakerTokenSupplyShareGte,
            XYCSwap._xycSwapXD,
            XYCConcentrate._xycConcentrateGrowLiquidity2D,
            Decay._decayXD,
            Controls._salt,
            Fee._flatFeeAmountInXD,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            _notInstruction,
            Fee._protocolFeeAmountInXD,
            Fee._aquaProtocolFeeAmountInXD,
            Fee._dynamicProtocolFeeAmountInXD,
            Fee._aquaDynamicProtocolFeeAmountInXD,
            PeggedSwap._peggedSwapGrowPriceRange2D,
            Extruction._extruction,
            Controls._onlyTxOriginTokenBalanceNonZero,
            SisuFee._sisuFeeXD,
            SisuLimit._sisuLimitXD
        ];

        uint256 instructionsArrayLength = instructions.length - 1;
        assembly ("memory-safe") {
            result := instructions
            mstore(result, instructionsArrayLength)
        }
    }
}
