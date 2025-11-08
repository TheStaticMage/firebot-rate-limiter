import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitInvocationLimit: ReplaceVariable = {
    definition: {
        handle: "rateLimitInvocationLimit",
        description: "Returns the maximum number of invocations allowed. Returns -1 if unlimited.",
        possibleDataOutput: ["number"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitInvocationLimit variable without expected metadata.');
            return 0;
        }
        if (!eventData.invocationLimit) {
            return -1;
        }
        return eventData.invocationLimitValue || 0;
    }
};
