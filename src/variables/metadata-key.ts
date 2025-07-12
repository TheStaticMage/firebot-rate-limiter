import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { logger } from '../main';
import { LimitExceededEventMetadata } from '../shared/types';

export const rateLimitMetadataKey: ReplaceVariable = {
    definition: {
        handle: "rateLimitMetadataKey",
        description: "Returns the metadata key configured in the effect that triggered this event.",
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": ['rate-limiter:limit-exceeded']
        }
    },
    evaluator: async (trigger: Effects.Trigger) => {
        const eventData = trigger.metadata?.eventData as LimitExceededEventMetadata | undefined;
        if (!eventData) {
            logger.warn('Called rateLimitMetadataKey variable without expected metadata.');
            return "";
        }
        return eventData.metadataKey || "";
    }
};
