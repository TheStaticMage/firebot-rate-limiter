import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from '@crowbartools/firebot-custom-scripts-types/types/triggers';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitTriggerMetadata: ReplaceVariable = {
    definition: {
        handle: "rateLimitTriggerMetadata",
        description: "Returns the metadata of the original event that triggered the rate limit check.",
        possibleDataOutput: ["object"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        return eventData?.triggerMetadata || {};
    }
};
