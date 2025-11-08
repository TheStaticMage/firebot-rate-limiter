import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitRawObject: ReplaceVariable = {
    definition: {
        handle: "rateLimitRawObject",
        description: "Returns the raw object for the rate limit rejection. **This is not guaranteed to be stable and may change in future versions.**",
        possibleDataOutput: ["object"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitRawObject variable without expected metadata.');
            return "unknown";
        }
        return eventData;
    }
};
