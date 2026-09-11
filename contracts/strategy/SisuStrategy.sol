// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm-template/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:copyright © 2025 Degensoft Ltd

import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraitsLib } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { ProgramBuilder, Program } from "@1inch/swap-vm/test/utils/ProgramBuilder.sol";
import { ControlsArgsBuilder } from "@1inch/swap-vm/src/instructions/Controls.sol";

import { SisuOpcodes } from "../opcodes/SisuOpcodes.sol";
import { SisuFeeArgsBuilder } from "../instructions/SisuFee.sol";
import { SisuLimitArgsBuilder } from "../instructions/SisuLimit.sol";

/// @notice Builds a 50/50 Sisu program: SISU_FEE → XYC → SISU_LIMIT.
contract SisuStrategy is SisuOpcodes {
    using ProgramBuilder for Program;

    error ZeroMaxRisk();
    error MaxFeeBelowBaseFee(uint32 baseFee, uint32 maxFee);

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
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);

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
