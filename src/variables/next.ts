import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitNext: ReplaceVariable = {
    definition: {
        handle: "rateLimitNext",
        description: "Returns the time (in seconds) until the next request is allowed. Returns -1 if the next request will never be allowed.",
        possibleDataOutput: ["number"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitNext variable without expected metadata.');
            return 0;
        }
        return eventData.next;
    }
};
