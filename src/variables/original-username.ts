import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitOriginalUsername: ReplaceVariable = {
    definition: {
        handle: "rateLimitOriginalUsername",
        description: "Returns the username of the user making the request that was rate limited.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Effects.Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitOriginalUsername variable without expected metadata.');
            return "";
        }
        return eventData.originalUsername;
    }
};
