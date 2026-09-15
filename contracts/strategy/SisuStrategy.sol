// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";

import { SisuOpcodes } from "../opcodes/SisuOpcodes.sol";
import { SISU_BPS, SisuFeeArgsBuilder } from "../instructions/SisuFee.sol";
import { SisuLimitArgsBuilder } from "../instructions/SisuLimit.sol";
import { ProgramBuilder, Program } from "../libraries/ProgramBuilder.sol";

/// @notice Builds a 50/50 Sisu program: SISU_FEE → XYC → SISU_LIMIT.
/// @dev Only ETH/stable pairs are supported: `SisuValuation` prices the non-ETH leg as $1, so exactly one
///      of `tokenA` / `tokenB` must be `ethToken`. Fee is capped at 100% (`SISU_BPS`).
contract SisuStrategy is SisuOpcodes {
    using ProgramBuilder for Program;

    error ZeroMaxRisk();
    error MaxFeeBelowBaseFee(uint32 baseFee, uint32 maxFee);
    error MaxFeeAboveBps(uint32 maxFee);
    error UnsupportedPair(address tokenA, address tokenB, address ethToken);

    constructor(address aqua) SisuOpcodes(aqua) {}

    function buildProgram(
        address maker,
        address tokenA,
        address tokenB,
        address oracle,
        address ethToken,
        uint32 maxStaleness,
        uint32 maxRisk,
        uint32 baseFee,
        uint32 maxFee,
        uint32 rebalanceStrength,
        uint64 salt,
        uint40 deadline
    ) external pure returns (ISwapVM.Order memory) {
        if (maxRisk == 0) revert ZeroMaxRisk();
        if (maxFee < baseFee) revert MaxFeeBelowBaseFee(baseFee, maxFee);
        // A fee above 100% makes the exact-in branch's `amountIn -= fee` underflow and brick the book.
        if (maxFee > SISU_BPS) revert MaxFeeAboveBps(maxFee);
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        // SisuValuation treats every non-eth token as $1; require exactly one ETH leg so risk is priced.
        if ((tokenA == ethToken) == (tokenB == ethToken)) revert UnsupportedPair(tokenA, tokenB, ethToken);

        Program memory program = ProgramBuilder.init(_opcodes());
        bytes memory feeArgs = SisuFeeArgsBuilder.build(
            oracle, ethToken, maxStaleness, maxRisk, baseFee, maxFee, rebalanceStrength
        );
        bytes memory limitArgs = SisuLimitArgsBuilder.build(oracle, ethToken, maxStaleness, maxRisk);

        bytes memory bytecode = bytes.concat(
            (deadline > 0) ? program.build(_deadline, ControlsArgsBuilder.buildDeadline(deadline)) : bytes(""),
            program.build(_sisuFeeXD, feeArgs),
            program.build(_xycSwapXD),
            program.build(_sisuLimitXD, limitArgs),
            (salt > 0) ? program.build(_salt, ControlsArgsBuilder.buildSalt(salt)) : bytes("")
        );

        return MakerTraitsLib.build(MakerTraitsLib.Args({
            maker: maker,
            receiver: address(0),
            tokenA: tokenA,
            tokenB: tokenB,
            shouldUnwrapWeth: false,
            useAquaInsteadOfSignature: true,
            allowZeroAmountIn: false,
            hasPreTransferInHook: false,
            hasPostTransferInHook: false,
            hasPreTransferOutHook: false,
            hasPostTransferOutHook: false,
            preTransferInTarget: address(0),
            preTransferInData: "",
            postTransferInTarget: address(0),
            postTransferInData: "",
            preTransferOutTarget: address(0),
            preTransferOutData: "",
            postTransferOutTarget: address(0),
            postTransferOutData: "",
            program: bytecode
        }));
    }
}
