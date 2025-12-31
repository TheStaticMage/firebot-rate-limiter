import { Firebot } from '@crowbartools/firebot-custom-scripts-types';
import { EffectScope } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { approvalService, logger } from '../main';

type undoEffectModel = {
    approvalId: string;
}


export const undoEffect: Firebot.EffectType<undoEffectModel> = {
    definition: {
        id: "thestaticmage:firebot-rate-limiter:undo",
        name: "Rate Limiter: Undo Check",
        description: "Undo a previous rate limit check by reversing token consumption and invocation count",
        icon: "fad fa-undo",
        categories: ["common"],
        dependencies: [],
        outputs: [
            {
                label: "Success",
                description: "Whether the undo operation was successful (true/false)",
                defaultName: "rateLimitUndoSuccess"
            },
            {
                label: "Reason",
                description: "Reason for failure if the undo was not successful (empty if successful)",
                defaultName: "rateLimitUndoReason"
            }
        ]
    },
    optionsTemplate: `
        <eos-container header="Approval ID" pad-top="true">
            <p class="muted">
                The unique approval ID from a rate limit check. This can be obtained from the check effect's
                "Approval ID" output or from the $rateLimitApprovalId replace variable in an approved event.
                <br><br>
                <strong>Note:</strong> Approval IDs expire after 10 minutes and can only be used once.
            </p>
            <firebot-input
                model="effect.approvalId"
                input-title="Approval ID"
                placeholder="Enter approval ID or variable"
            />
        </eos-container>
    `,
    optionsController: ($scope: EffectScope<undoEffectModel>) => {
        if (!$scope.effect.approvalId) {
            $scope.effect.approvalId = "";
        }
    },
    optionsValidator: (effect: undoEffectModel) => {
        const errors: string[] = [];
        if (!effect.approvalId || effect.approvalId.trim() === "") {
            errors.push("Approval ID is required");
        }
        return errors;
    },
    onTriggerEvent: async (event) => {
        const { effect } = event;

        const result = {
            success: true,
            outputs: {
                rateLimitUndoSuccess: "false",
                rateLimitUndoReason: ""
            }
        };

        const approvalId = effect.approvalId.trim();
        if (!approvalId) {
            logger.warn("Undo effect called with empty approval ID");
            result.outputs.rateLimitUndoReason = "empty_approval_id";
            return result;
        }

        const undoResponse = approvalService.undoApproval(approvalId);

        if (undoResponse.success) {
            result.outputs.rateLimitUndoSuccess = "true";
            logger.debug(`Undo effect successful: approvalId=${approvalId}`);
        } else {
            result.outputs.rateLimitUndoReason = undoResponse.reason || "unknown";
            logger.debug(`Undo effect failed: approvalId=${approvalId} reason=${undoResponse.reason}`);
        }

        return result;
    }
};
