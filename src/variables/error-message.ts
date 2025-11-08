import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitErrorMessage: ReplaceVariable = {
    definition: {
        handle: "rateLimitErrorMessage",
        description: "Returns an error message when the rate limit is exceeded.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitErrorMessage variable without expected metadata.');
            return "Rate limit exceeded. Please try again later.";
        }
        if (!eventData.errorMessage) {
            logger.warn('Rate limit exceeded without an error message.');
            return "Rate limit exceeded. Please try again later.";
        }
        return eventData.errorMessage;
    }
};
