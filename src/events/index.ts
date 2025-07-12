import { EventSource } from '@crowbartools/firebot-custom-scripts-types/types/modules/event-manager';
import { firebot, logger } from '../main';
import { RejectReason } from '../shared/types';

const eventSource: EventSource = {
    id: "rate-limiter",
    name: "Rate Limiter",
    events: [
        {
            id: "limit-exceeded",
            name: "Rate Limit Exceeded",
            description: "Fires when the rate limit is exceeded.",
            manualMetadata: {
                next: 15, // Default next time in seconds
                remaining: 7, // Default remaining requests
                invocationLimit: 10, // Default invocation limit
                errorMessage: "Rate limit exceeded. Please try again later.",
                rejectReason: RejectReason.RateLimit
            }
        }
    ]
};

export function registerEventSource() {
    const { eventManager } = firebot.modules;
    eventManager.registerEventSource(eventSource);
}

export function emitEvent(
    eventId: string,
    meta: Record<string, unknown>,
    isManual?: boolean
): void {
    logger.debug(`Emitting event: ${eventId} from source: ${eventSource.id} with metadata: ${JSON.stringify(meta)}`);

    const { eventManager } = firebot.modules;
    eventManager.triggerEvent(eventSource.id, eventId, meta, isManual);
}
