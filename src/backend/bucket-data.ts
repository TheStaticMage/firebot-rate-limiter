import { firebot, logger } from '../main';
import { Bucket, BucketDataEntry, CheckRateLimitRequest, CheckRateLimitResponse, InstantiateBucketParameters, RejectReason } from '../shared/types';
import { bucketService, BucketService } from './bucket-service';
import { getDataFilePath } from './util';

const bucketDataFilename = 'persisted-bucket-data.json';
const bucketDataPersistenceWriteInterval = 5000; // 5 seconds

export let bucketData: BucketData;

type BucketDataObject = Record<string, BucketDataEntry>;

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
    private persistedDataFileWriteInterval: NodeJS.Timeout | null = null;
    private startTime = Date.now();

    constructor() {
        this.bucketData = this.loadBucketDataFromFile();
        this.bucketService = bucketService;
        this.startAutoSave();
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

        // Add tokens between the last access and now
        const lastUpdated = bData.lastUpdated || Date.now();
        let elapsedTime = Date.now() - lastUpdated;
        if (elapsedTime < 0) {
            elapsedTime = 0; // Prevent negative time
        }
        const addTokensByTime = bucket.refillRate * (elapsedTime / 1000);

        let addTokens = 0;
        if (bucket.lifetimeMaxTokens) {
            // If lifetime max tokens is set, we need to ensure we don't exceed it
            const maxTokens = bucket.lifetimeMaxTokensValue || 999999999; // Default to a very high number if not set
            addTokens = Math.min(addTokensByTime, maxTokens - bData.lifetimeTokenCount);
        } else {
            // If lifetime max tokens is not set, we can add as many as possible
            addTokens = addTokensByTime;
        }

        const newTokenCount = Math.min(bucket.maxTokens, bData.tokenCount + Math.max(0, addTokens));
        this.bucketData[bucketId][key] = {
            tokenCount: newTokenCount,
            lifetimeTokenCount: bData.lifetimeTokenCount + newTokenCount - bData.tokenCount,
            lastUpdated: Date.now(),
            invocationCount: bData.invocationCount
        };

        return this.bucketData[bucketId][key];
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
        const fillTokens = bucket.fillFromStart ? bucket.refillRate * (Date.now() - this.startTime) / 1000 : 0;
        const initialTokens = Math.min(bucket.maxTokens, bucket.startTokens + fillTokens);
        this.bucketData[bucketId][key] = {
            tokenCount: initialTokens,
            lifetimeTokenCount: initialTokens,
            lastUpdated: Date.now(),
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
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Error loading bucket data from file: ${this.filePath} error=${error}`);
            return {};
        }
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
