import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitInvocation: ReplaceVariable = {
    definition: {
        handle: "rateLimitInvocation",
        description: "Returns the number of invocations made in this check that were successful.",
        possibleDataOutput: ["number"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitInvocation variable without expected metadata.');
            return 0;
        }
        return eventData.invocation || 0;
    }
};
