import { EventData, EventFilter, FilterSettings, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { bucketService } from "../backend/bucket-service";
import { logger } from "../main";
import { GetBucketResponse, GetBucketsAsArrayResponse } from "../shared/types";

export const bucketFilter: EventFilter = {
    id: `rate-limiter:bucket`,
    name: "Rate Limiter Bucket",
    description: "Limit to a specific bucket that triggered the event",
    events: [
        { eventSourceId: "rate-limiter", eventId: "limit-exceeded" },
        { eventSourceId: "rate-limiter", eventId: "approved" }
    ],
    comparisonTypes: ["is", "is not"],
    valueType: "preset",
    getSelectedValueDisplay: (filterSettings: FilterSettings, backendCommunicator: any): string => {
        const bucketResponse: GetBucketResponse = backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId: filterSettings.value });
        if (bucketResponse.errorMessage) {
            return "[Error]";
        }

        return bucketResponse.bucket ? bucketResponse.bucket.name : "[Unknown]";
    },
    valueIsStillValid: (filterSettings: FilterSettings, backendCommunicator: any): boolean => {
        const bucketResponse: GetBucketResponse = backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId: filterSettings.value });
        if (bucketResponse.errorMessage) {
            return false;
        }

        return !!bucketResponse.bucket;
    },
    presetValues: (backendCommunicator: any, ngToast: any): PresetValue[] => {
        const bucketsResponse: GetBucketsAsArrayResponse = backendCommunicator.fireEventSync("rate-limiter:getBucketsAsArray", {});
        if (bucketsResponse.errorMessage) {
            ngToast.create({className: 'danger', content: `Error loading buckets: ${bucketsResponse.errorMessage}`});
            return [];
        }

        if (bucketsResponse.buckets.length === 0) {
            ngToast.create({className: 'danger', content: "No buckets found. Create some in the 'RATE LIMITER' screen."});
            return [];
        }

        return bucketsResponse.buckets.map(bucket => ({
            value: bucket.id,
            display: bucket.name
        }));
    },
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        // If the bucket data is unknown then always return true.
        const bucketId = typeof eventData.eventMeta?.bucketId === "string" ? eventData.eventMeta.bucketId : undefined;
        if (!bucketId || !filterSettings.value) {
            logger.warn("bucketFilter: Bucket ID or filter value is missing. Passing event.");
            return true;
        }

        // If the bucket is no longer valid then always return true.
        const bucket = bucketService.getBucket(bucketId);
        if (!bucket) {
            logger.warn("bucketFilter: Bucket in filter is no longer valid. Passing event.");
            return true;
        }

        // True if bucketId matches value and comparisonType is "is", or if they don't match and comparisonType is "is not"
        const result = ((bucketId === String(filterSettings.value)) === (filterSettings.comparisonType === "is"));
        logger.debug(`bucketFilter: result=${result} bucketId=${bucketId} filterValue=${filterSettings.value} comparisonType=${filterSettings.comparisonType}`);
        return result;
    }
};
