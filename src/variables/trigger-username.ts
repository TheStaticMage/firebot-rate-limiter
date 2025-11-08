import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitTriggerUsername: ReplaceVariable = {
    definition: {
        handle: "rateLimitTriggerUsername",
        description: "Returns the username from the original event source that triggered the rate limit check.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        return eventData?.triggerUsername || "";
    }
};
