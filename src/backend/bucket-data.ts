import { FrontendCommunicator } from '@crowbartools/firebot-custom-scripts-types/types/modules/frontend-communicator';
import { firebot, logger } from '../main';
import { Bucket, BucketDataEntry, BucketDataObject, CheckRateLimitRequest, CheckRateLimitResponse, GetBucketDataResponse, InstantiateBucketParameters, RejectReason, SaveBucketDataResponse } from '../shared/types';
import { bucketService, BucketService } from './bucket-service';
import { getDataFilePath } from './util';

const bucketDataFilename = 'persisted-bucket-data.json';
const bucketDataPersistenceWriteInterval = 5000; // 5 seconds

export let bucketData: BucketData;

export function initializeBucketData(): void {
    if (!bucketData) {
        bucketData = new BucketData();
        logger.debug("BucketData initialized.");
    } else {
        logger.debug("BucketData already initialized.");
    }
}

export class BucketData {
    private bucketData: Record<string, BucketDataObject> = {};
    private bucketService: BucketService = bucketService;
    private filePath = getDataFilePath(bucketDataFilename);
    private frontendCommunicator: FrontendCommunicator;
    private persistedDataFileWriteInterval: NodeJS.Timeout | null = null;
    private startTime: number;

    constructor(startTime?: number) {
        this.frontendCommunicator = firebot.modules.frontendCommunicator;
        this.startTime = startTime ?? Date.now();
        this.bucketData = this.loadBucketDataFromFile();
        this.bucketService = bucketService;
        this.startAutoSave();

        this.frontendCommunicator.on("rate-limiter:getBucketData", (data: { bucketId: string }): GetBucketDataResponse => {
            return this.handleGetBucketDataEvent(data);
        });
        logger.debug("Registered rate-limiter:getBucketData frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:saveBucketData", (data: { bucketId: string, bucketData: string, dryRun: boolean }): SaveBucketDataResponse => {
            return this.handleSaveBucketDataEvent(data);
        });
        logger.debug("Registered rate-limiter:saveBucketData frontend communicator handler.");
    }

    private handleGetBucketDataEvent(data: { bucketId: string }): GetBucketDataResponse {
        const { bucketId } = data;
        const bucket = this.getBucket(bucketId);
        if (!bucket) {
            logger.warn(`rate-limiter:getBucketData: No bucket data found for bucket ID: ${bucketId}`);
            return { bucketData: null, errorMessage: `No bucket found for bucket ID: ${bucketId}` };
        }

        const bData = this.refreshTokensForBucket(bucketId, bucket);
        logger.debug(`rate-limiter:getBucketData: Retrieved bucket data for bucket ID: ${bucketId} (${Object.keys(bData).length} keys)`);
        return { bucketData: bData };
    }

    private handleSaveBucketDataEvent(data: { bucketId: string, bucketData: string, dryRun: boolean }): SaveBucketDataResponse {
        const { bucketId, bucketData, dryRun } = data;

        // Validate that the bucket exists if given
        if (bucketId || !dryRun) {
            const bucket = this.getBucket(bucketId);
            if (!bucket) {
                logger.warn(`rate-limiter:saveBucketData: No bucket found for bucket ID: ${bucketId}`);
                return { success: false, errorMessage: `No bucket found for bucket ID: ${bucketId}` };
            }
        }

        // Validate that rawBucketData is a valid JSON string
        let parsedBucketData: BucketDataObject;
        try {
            parsedBucketData = JSON.parse(bucketData);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.warn(`rate-limiter:saveBucketData: Invalid JSON provided for bucket ID: ${bucketId} - ${errorMsg}`);
            return { success: false, errorMessage: `Invalid JSON provided for bucket ID: ${bucketId} - ${errorMsg}` };
        }

        // Validate that bucketData is a BucketDataObject (object with string keys and BucketDataEntry values)
        if (typeof parsedBucketData !== 'object' || parsedBucketData === null || Array.isArray(parsedBucketData)) {
            logger.warn(`rate-limiter:saveBucketData: Invalid bucketData provided for bucket ID: ${bucketId} - expected object but got ${typeof parsedBucketData}`);
            return { success: false, errorMessage: `Invalid bucketData provided for bucket ID: ${bucketId} - expected object but got ${typeof parsedBucketData}` };
        }

        // Validate each entry in the bucketData
        for (const [key, entry] of Object.entries(parsedBucketData)) {
            const errors: string[] = [];

            if (typeof entry !== 'object' || entry === null) {
                errors.push(`entry is not an object (got ${typeof entry})`);
            } else {
                if (typeof entry.tokenCount !== 'number') {
                    errors.push(`tokenCount is not a number (got ${typeof entry.tokenCount})`);
                }
                if (typeof entry.lifetimeTokenCount !== 'number') {
                    errors.push(`lifetimeTokenCount is not a number (got ${typeof entry.lifetimeTokenCount})`);
                }
                if (typeof entry.lastUpdated !== 'number') {
                    errors.push(`lastUpdated is not a number (got ${typeof entry.lastUpdated})`);
                }
                if (typeof entry.invocationCount !== 'number') {
                    errors.push(`invocationCount is not a number (got ${typeof entry.invocationCount})`);
                }
            }

            if (errors.length > 0) {
                const errorMessage = `Invalid bucketData for ${key} - ${errors.join(', ')}`;
                logger.warn(`rate-limiter:saveBucketData: ${errorMessage}`);
                return { success: false, errorMessage };
            }
        }

        if (!dryRun) {
            this.bucketData[bucketId] = parsedBucketData;
            logger.debug(`rate-limiter:saveBucketData: Saved bucket data for bucket ID: ${bucketId}`);
        }

        return { success: true };
    }

    check(request: CheckRateLimitRequest): CheckRateLimitResponse {
        let instantiateBucketParameters: InstantiateBucketParameters | undefined;
        if (request.bucketType === 'simple') {
            instantiateBucketParameters = {
                bucketSize: request.bucketSize,
                bucketRate: request.bucketRate
            };
        }

        const bucket = this.getBucket(request.bucketId, instantiateBucketParameters);
        if (!bucket) {
            // Since it's possible that the bucket was deleted and we don't have
            // a good way to ensure referential integrity, we mark this request
            // as a success.
            logger.error(`Bucket not found: id=${request.bucketId} key=${request.key} tokenCount=${request.tokenRequest} (inquiry=${request.inquiry})`);
            return { success: true, next: 0, remaining: -1, invocation: 0 };
        }

        const bData = this.addTokens(request.bucketId, bucket, request.key);
        this.bucketData[request.bucketId][request.key] = bData;

        if (request.tokenRequest > bData.tokenCount) {
            return {
                success: false,
                next: this.estimateNextAvailable(bucket, bData, request.tokenRequest),
                remaining: this.getRemainingInvocations(request, bData),
                invocation: bData.invocationCount,
                rejectReason: RejectReason.RateLimit,
                errorMessage: `Insufficient tokens (has ${bData.tokenCount}, needs ${request.tokenRequest})`
            };
        }

        if (request.invocationLimit && bData.invocationCount >= request.invocationLimitValue) {
            return {
                success: false,
                next: this.estimateNextAvailable(bucket, bData, request.tokenRequest),
                remaining: 0,
                invocation: bData.invocationCount,
                rejectReason: RejectReason.InvocationLimit,
                errorMessage: `Invocation limit reached (limit=${request.invocationLimitValue}, current=${bData.invocationCount})`
            };
        }

        if (!request.inquiry) {
            bData.invocationCount += 1;
            bData.tokenCount -= Number(request.tokenRequest);
            this.bucketData[request.bucketId][request.key] = bData;
        }

        return {
            success: true,
            next: this.estimateNextAvailable(bucket, bData, request.tokenRequest),
            remaining: this.getRemainingInvocations(request, bData),
            invocation: bData.invocationCount
        };
    }

    deleteKey(bucketId: string, key: string): boolean {
        if (!this.bucketData[bucketId] || !this.bucketData[bucketId][key]) {
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.bucketData[bucketId][key];
        return true;
    }

    getAllBucketData(bucketId: string): Record<string, BucketDataEntry> {
        return this.bucketData[bucketId] || {};
    }

    listKeys(bucketId: string): string[] {
        const keys: string[] = [];
        if (!this.bucketData[bucketId]) {
            return keys;
        }
        return Object.keys(this.bucketData[bucketId]);
    }

    addTokens(bucketId: string, bucket: Bucket, key: string): BucketDataEntry {
        const bData = this.getBucketData(bucketId, bucket, key);
        this.bucketData[bucketId][key] = this.addTokensToBucket(bucket, bData);
        return this.bucketData[bucketId][key];
    }

    private addTokensToBucket(bucket: Bucket, bData: BucketDataEntry): BucketDataEntry {
        // Add tokens between the last access and now
        const lastUpdated = bData.lastUpdated || (bucket.fillFromStart ? this.startTime : 0) || Date.now();
        let elapsedTime = Date.now() - lastUpdated;
        if (elapsedTime < 0) {
            elapsedTime = 0; // Prevent negative time
        }
        const addTokensByTime = bucket.refillRate * (elapsedTime / 1000);

        let tokensToAdd = 0;
        if (bucket.lifetimeMaxTokens) {
            // If lifetime max tokens is set, we need to ensure we don't exceed it
            const maxTokens = bucket.lifetimeMaxTokensValue || 999999999; // Default to a very high number if not set
            tokensToAdd = Math.min(addTokensByTime, maxTokens - bData.lifetimeTokenCount);
        } else {
            // If lifetime max tokens is not set, we can add as many as possible
            tokensToAdd = addTokensByTime;
        }

        // Only add tokens if time has passed
        let newTokenCount = bData.tokenCount;
        let newLifetimeTokenCount = bData.lifetimeTokenCount;
        if (tokensToAdd > 0) {
            newTokenCount = Math.min(bucket.maxTokens, bData.tokenCount + tokensToAdd);
            newLifetimeTokenCount = bData.lifetimeTokenCount + (newTokenCount - bData.tokenCount);
        }

        return {
            tokenCount: newTokenCount,
            lifetimeTokenCount: newLifetimeTokenCount,
            lastUpdated: Date.now(),
            invocationCount: bData.invocationCount
        };
    }

    private estimateNextAvailable(bucket: Bucket, bData: BucketDataEntry, tokenRequest: number): number {
        const availableTokens = bData.tokenCount;
        if (availableTokens >= tokenRequest) {
            return 0; // Tokens are already available
        }

        if (tokenRequest > bucket.maxTokens || bucket.refillRate <= 0) {
            return -1; // Tokens will never be available
        }

        const tokensNeeded = tokenRequest - availableTokens;
        return tokensNeeded / bucket.refillRate;
    }

    private getRemainingInvocations(request: CheckRateLimitRequest, bData: BucketDataEntry): number {
        if (request.invocationLimit) {
            return Math.max(0, request.invocationLimitValue - bData.invocationCount);
        }
        return -1; // No invocation limit
    }

    private getBucket(bucketId: string, params: InstantiateBucketParameters | null = null): Bucket | undefined {
        return this.bucketService.getBucket(bucketId, params);
    }

    private getBucketData(bucketId: string, bucket: Bucket, key: string): BucketDataEntry {
        // Initialize bucket data if it doesn't exist
        if (!this.bucketData[bucketId]) {
            this.bucketData[bucketId] = {};
        }

        // Return existing data if available
        const bData = this.bucketData[bucketId][key];
        if (bData) {
            return bData;
        }

        // Initialize new bucket data entry
        const initialTokens = Math.min(bucket.maxTokens, bucket.startTokens);
        this.bucketData[bucketId][key] = {
            tokenCount: initialTokens,
            lifetimeTokenCount: initialTokens,
            lastUpdated: bucket.fillFromStart ? this.startTime : Date.now(),
            invocationCount: 0
        };
        return this.bucketData[bucketId][key];
    }

    private getPersistentBucketData(): Record<string, BucketDataObject> {
        const allBuckets = this.bucketService.getBuckets();
        const persistentData: Record<string, BucketDataObject> = {};
        for (const [bucketId, data] of Object.entries(this.bucketData)) {
            if (allBuckets[bucketId] && allBuckets[bucketId].persistBucket) {
                persistentData[bucketId] = data;
            }
        }
        return persistentData;
    }

    hasKey(bucketId: string, key: string): boolean {
        return !!(this.bucketData[bucketId] && this.bucketData[bucketId][key]);
    }

    private loadBucketDataFromFile(): Record<string, BucketDataObject> {
        try {
            const { fs } = firebot.modules;
            if (!fs.existsSync(this.filePath)) {
                this.saveBucketDataToFile({});
            }

            const data = fs.readFileSync(this.filePath, 'utf-8');
            return this.parseFileData(data);
        } catch (error) {
            logger.error(`Error loading bucket data from file: ${this.filePath} error=${error}`);
            return {};
        }
    }

    private parseFileData(data: string): Record<string, BucketDataObject> {
        const parsed: Record<string, BucketDataObject> = JSON.parse(data);
        const result: Record<string, BucketDataObject> = {};
        for (const [bucketId, bucketData] of Object.entries(parsed)) {
            const bucket = this.getBucket(bucketId);
            if (bucket) {
                result[bucketId] = bucketData;
                if (!bucket.fillBucketAcrossRestarts) {
                    for (const entryKey of Object.keys(result[bucketId])) {
                        result[bucketId][entryKey].lastUpdated = 0;
                    }
                }
            }
        }
        return result;
    }

    private refreshTokensForBucket(bucketId: string, bucket: Bucket): BucketDataObject {
        if (!this.bucketData[bucketId]) {
            return {};
        }
        for (const [key, entry] of Object.entries(this.bucketData[bucketId])) {
            this.bucketData[bucketId][key] = this.addTokensToBucket(bucket, entry);
        }
        return this.bucketData[bucketId];
    }

    private saveBucketDataToFile(data: Record<string, BucketDataObject>): void {
        try {
            const { fs } = firebot.modules;
            const jsonData = JSON.stringify(data, null, 2);
            fs.writeFileSync(this.filePath, jsonData, 'utf-8');
        } catch (error) {
            logger.error(`Error saving bucket data to file: ${this.filePath} error=${error}`);
        }
    }

    setKey(bucketId: string, key: string, data: BucketDataEntry): void {
        if (!this.bucketData[bucketId]) {
            // This should never happen
            logger.error(`Attempted to set key for non-existent bucket: id=${bucketId}`);
            return;
        }
        this.bucketData[bucketId][key] = data;
    }

    private startAutoSave(): void {
        if (this.persistedDataFileWriteInterval) {
            clearInterval(this.persistedDataFileWriteInterval);
        }
        this.persistedDataFileWriteInterval = setInterval(() => {
            this.saveBucketDataToFile(this.getPersistentBucketData());
        }, bucketDataPersistenceWriteInterval);
    }
}
