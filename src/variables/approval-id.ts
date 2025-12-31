import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitApprovedEventMetadata } from '../shared/types';

export const rateLimitApprovalId: ReplaceVariable = {
    definition: {
        handle: "rateLimitApprovalId",
        description: "Returns the unique approval ID from a rate limit check that was approved. This ID can be used with the undo effect within 10 minutes.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:approved']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitApprovedEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitApprovalId variable without expected metadata.');
            return "";
        }
        return eventData.approvalId || "";
    }
};
