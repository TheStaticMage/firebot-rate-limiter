import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitRemaining: ReplaceVariable = {
    definition: {
        handle: "rateLimitRemaining",
        description: "Returns the number of requests remaining. Returns -1 if unlimited.",
        possibleDataOutput: ["number"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitRemaining variable without expected metadata.');
            return -1;
        }
        return eventData.remaining;
    }
};
