import { FrontendCommunicator } from '@crowbartools/firebot-custom-scripts-types/types/modules/frontend-communicator';
import { firebot, logger } from '../main';
import { Bucket, BucketWithId, DeleteBucketResponse, GetBucketResponse, GetBucketsAsArrayResponse, GetBucketsResponse, InstantiateBucketParameters, SaveBucketResponse } from '../shared/types';
import { getDataFilePath } from './util';

const bucketFilename = 'buckets.json';

export let bucketService: BucketService;

export function initializeBucketService(): void {
    if (!bucketService) {
        bucketService = new BucketService();
        logger.debug("BucketService initialized.");
    } else {
        logger.debug("BucketService already initialized.");
    }
}

export class BucketService {
    private advancedBucketsEnabled = false;
    private buckets: Record<string, Bucket> = {};
    private fileReadError = "";
    private filePath = getDataFilePath(bucketFilename);
    private frontendCommunicator: FrontendCommunicator;

    constructor() {
        this.frontendCommunicator = firebot.modules.frontendCommunicator;

        this.frontendCommunicator.on("rate-limiter:deleteBucket", (data: { bucketId: string }): DeleteBucketResponse => {
            const { bucketId } = data;
            try {
                this.deleteBucket(bucketId);
                return { buckets: this.getBuckets() };
            } catch (error) {
                logger.error(`Error deleting bucket: id=${bucketId} error=${error}`);
                return { buckets: this.getBuckets(), errorMessage: String(error) };
            }
        });
        logger.debug("Registered rate-limiter:deleteBucket frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:getAdvancedBucketsEnabled", (): boolean => {
            return this.advancedBucketsEnabled;
        });
        logger.debug("Registered rate-limiter:getAdvancedBucketsEnabled frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:getBucket", (data: { bucketId: string }): GetBucketResponse => {
            const { bucketId } = data;
            if (this.fileReadError) {
                return { bucket: null, errorMessage: this.fileReadError };
            }
            const bucket = this.getBucket(bucketId);
            return { bucket: bucket ? { ...bucket, id: bucketId } : null };
        });
        logger.debug("Registered rate-limiter:getBucket frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:getBuckets", (): GetBucketsResponse => {
            if (this.fileReadError) {
                return { buckets: {}, errorMessage: this.fileReadError };
            }
            return { buckets: this.getBuckets() };
        });
        logger.debug("Registered rate-limiter:getBuckets frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:getBucketsAsArray", (): GetBucketsAsArrayResponse => {
            if (this.fileReadError) {
                return { buckets: [], errorMessage: this.fileReadError };
            }
            return { buckets: this.getBucketsAsArray() };
        });
        logger.debug("Registered rate-limiter:getBucketsAsArray frontend communicator handler.");

        this.frontendCommunicator.on("rate-limiter:saveBucket", (data: { bucketId: string; bucket: Bucket }): SaveBucketResponse => {
            const { bucketId, bucket } = data;
            try {
                this.saveBucket(bucketId, bucket);
                return { buckets: this.getBuckets() };
            } catch (error) {
                logger.error(`Error saving bucket: id=${bucketId} error=${error}`);
                return { buckets: this.getBuckets(), errorMessage: String(error) };
            }
        });
        logger.debug("Registered rate-limiter:saveBucket frontend communicator handler.");

        this.loadBucketsFromFile();
        logger.debug(`BucketService initialized with file path: ${this.filePath}`);
    }

    private deleteBucket(bucketId: string): void {
        if (!this.buckets[bucketId]) {
            throw new Error(`Attempted to delete non-existent bucket: id=${bucketId}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.buckets[bucketId];
        logger.info(`Deleted bucket: id=${bucketId}`);
        this.saveBucketsToFile();
    }

    getBucket(bucketId: string, params: InstantiateBucketParameters | null = null): Bucket | undefined {
        if (this.buckets[bucketId]) {
            return this.buckets[bucketId];
        }

        // Instantiate a new bucket if it doesn't exist for bucket type 'simple'
        if (params) {
            this.buckets[bucketId] = {
                name: bucketId,
                type: 'simple',
                maxTokens: params.bucketSize,
                refillRate: params.bucketRate,
                startTokens: params.bucketSize,
                lifetimeMaxTokens: false,
                lifetimeMaxTokensValue: 0,
                persistBucket: false,
                fillFromStart: true
            };
            return this.buckets[bucketId];
        }

        logger.warn(`Attempted to get non-existent bucket: id=${bucketId}`);
        return undefined;
    }

    getBuckets(): Record<string, Bucket> {
        return this.buckets;
    }

    private getBucketsAsArray(): BucketWithId[] {
        const bucketArray = Object.entries(this.buckets).map(([id, bucket]) => ({
            ...(bucket),
            id
        }));

        const filtered = bucketArray.filter(bucket => bucket.type !== 'simple');
        filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        return filtered;
    }

    private saveBucket(bucketId: string, updatedBucket: Bucket): void {
        // Convert string number fields to numbers if necessary
        if (typeof updatedBucket.startTokens === 'string') {
            updatedBucket.startTokens = Number(updatedBucket.startTokens);
        }
        if (typeof updatedBucket.lifetimeMaxTokensValue === 'string') {
            updatedBucket.lifetimeMaxTokensValue = Number(updatedBucket.lifetimeMaxTokensValue);
        }
        if (typeof updatedBucket.maxTokens === 'string') {
            updatedBucket.maxTokens = Number(updatedBucket.maxTokens);
        }
        if (typeof updatedBucket.refillRate === 'string') {
            updatedBucket.refillRate = Number(updatedBucket.refillRate);
        }

        this.validateBucket(bucketId, updatedBucket);
        updatedBucket.name = updatedBucket.name.trim();
        this.buckets[bucketId] = updatedBucket;
        this.saveBucketsToFile();
        logger.info(`Updated bucket: id=${bucketId} name=${updatedBucket.name}`);
    }

    private loadBucketsFromFile(): void {
        try {
            const fs = firebot.modules.fs;
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(data);
                this.buckets = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, Bucket> : {};
                logger.debug(`Loaded ${Object.keys(this.buckets).length} buckets from ${this.filePath}`);
            } else {
                logger.debug(`No bucket file found at ${this.filePath}. Starting with an empty bucket list.`);
                this.saveBucketsToFile();
            }
        } catch (error) {
            logger.error(`Failed to load buckets from ${this.filePath}: ${error}`);
            this.buckets = {};
            this.fileReadError = `Failed to load buckets: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    private saveBucketsToFile(): void {
        const fs = firebot.modules.fs;
        fs.writeFileSync(this.filePath, JSON.stringify(this.buckets, null, 2));
        logger.debug(`Saved ${Object.keys(this.buckets).length} buckets to ${this.filePath}`);
    }

    private validateBucket(bucketId: string, bucket: Bucket): void {
        if (!bucketId) {
            throw new Error("Invalid bucket definition: Missing ID.");
        }

        if (!bucket.name.trim()) {
            throw new Error("Invalid bucket definition: Missing or empty name.");
        }

        const nameToCheck = bucket.name.trim().toLowerCase();
        for (const [id, existingBucket] of Object.entries(this.buckets)) {
            if (id !== bucketId && existingBucket && existingBucket.name.trim().toLowerCase() === nameToCheck) {
                throw new Error(`Invalid bucket definition: A bucket with the name "${bucket.name}" already exists.`);
            }
        }

        if (bucket.maxTokens < 0) {
            throw new Error("Invalid bucket definition: Maximum tokens must be non-negative.");
        }

        if (bucket.refillRate < 0) {
            throw new Error("Invalid bucket definition: Bucket refill rate must be non-negative.");
        }
    }

    setAdvancedBucketsEnabled(enabled: boolean): void {
        this.advancedBucketsEnabled = enabled;
        logger.info(`Advanced Buckets feature set to: ${enabled}`);
        this.frontendCommunicator.send('rate-limiter:show-hide-advanced-buckets', enabled);
    }
}
