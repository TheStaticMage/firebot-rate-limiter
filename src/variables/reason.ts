import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitRejectReason: ReplaceVariable = {
    definition: {
        handle: "rateLimitRejectReason",
        description: "Returns the reason for the rate limit rejection.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Effects.Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitRejectReason variable without expected metadata.');
            return "unknown";
        }
        if (!eventData.rejectReason) {
            logger.warn('Rate limit exceeded without a reject reason.');
            return "unknown";
        }
        return eventData.rejectReason;
    }
};
