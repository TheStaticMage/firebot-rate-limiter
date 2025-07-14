import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitTriggerType: ReplaceVariable = {
    definition: {
        handle: "rateLimitTriggerType",
        description: "Returns the type of the original event that triggered the rate limit check.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Effects.Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        return eventData?.triggerType || "";
    }
};
