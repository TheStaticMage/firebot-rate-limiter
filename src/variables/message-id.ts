import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitMessageId: ReplaceVariable = {
    definition: {
        handle: "rateLimitMessageId",
        description: "Returns the ID of the chat message that triggered the rate limit check.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitMessageId variable without expected metadata.');
            return "";
        }
        return eventData.messageId;
    }
};
