import { Bucket, BucketDataEntry, CheckRateLimitRequest, RejectReason } from '../shared/types';
import { BucketData } from './bucket-data';

jest.mock('../main', () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('./bucket-service', () => {
    const buckets: Record<string, any> = {};
    return {
        bucketService: {
            getBucket: jest.fn((bucketId: string) => buckets[bucketId]),
            getBuckets: jest.fn(() => buckets),
            __setBuckets: (b: any) => {
                Object.assign(buckets, b);
            }
        },
        BucketService: jest.fn()
    };
});

jest.mock('./util', () => ({
    getDataFilePath: jest.fn(() => '/tmp/test-bucket-data.json')
}));


describe('BucketData', () => {
    it('should not exceed lifetimeMaxTokens when adding tokens', () => {
        const lifetimeBucket: Bucket = {
            name: 'lifetime',
            type: 'simple',
            maxTokens: 10,
            refillRate: 100, // high refill rate to test cap
            startTokens: 5,
            fillFromStart: false,
            persistBucket: true,
            lifetimeMaxTokens: true,
            lifetimeMaxTokensValue: 7
        };
        mockedBucketService.__setBuckets({
            lifetime: lifetimeBucket
        });
        bucketData = new BucketData();
        // First addTokens should set lifetimeTokenCount to 5
        let entry = bucketData.addTokens('lifetime', lifetimeBucket, key);
        expect(entry.lifetimeTokenCount).toBe(5);
        // Simulate time passing to try to add more tokens
        jest.setSystemTime(now + 10000); // 10 seconds
        entry = bucketData.addTokens('lifetime', lifetimeBucket, key);
        // Should not exceed lifetimeMaxTokensValue (7)
        expect(entry.lifetimeTokenCount).toBeLessThanOrEqual(7);
    });

    it('should initialize with fillFromStart tokens', () => {
        const fillBucket: Bucket = {
            name: 'fill',
            type: 'simple',
            maxTokens: 20,
            refillRate: 2, // 2 tokens/sec
            startTokens: 0,
            fillFromStart: true,
            persistBucket: true,
            lifetimeMaxTokens: false,
            lifetimeMaxTokensValue: 0
        };
        mockedBucketService.__setBuckets({
            fill: fillBucket
        });
        // Simulate 5 seconds since start
        const fiveSecondsAgo = now;
        const nowPlus5s = now + 5000;
        jest.setSystemTime(nowPlus5s);
        bucketData = new BucketData(fiveSecondsAgo);
        // The first addTokens should initialize with fillTokens = refillRate * (now - startTime) / 1000
        // But since startTokens is 0, should be 2 * 5 = 10 tokens
        const entry = bucketData.addTokens('fill', fillBucket, key);
        expect(entry.tokenCount).toBe(10);
        expect(entry.lifetimeTokenCount).toBe(10);
    });
    let bucketData: BucketData;
    const bucketId = 'bucket1';
    const key = 'user1';
    const now = Date.now();

    const bucket: Bucket = {
        name: 'bucket1',
        type: 'simple',
        maxTokens: 10,
        refillRate: 1,
        startTokens: 5,
        fillFromStart: false,
        persistBucket: true,
        lifetimeMaxTokens: false,
        lifetimeMaxTokensValue: 0
    };

    // Use the mocked bucketService from require, not the imported one
    const mockedBucketService = require('./bucket-service').bucketService;
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(now);
        (require('../main').firebot.modules.fs.existsSync as jest.Mock).mockReturnValue(false);
        (require('../main').firebot.modules.fs.readFileSync as jest.Mock).mockReturnValue('{}');
        mockedBucketService.__setBuckets({
            [bucketId]: bucket
        });
        bucketData = new BucketData();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('should initialize and load empty data', () => {
        expect(bucketData.getAllBucketData(bucketId)).toEqual({});
    });

    it('should add tokens and update bucket data', () => {
        const entry = bucketData.addTokens(bucketId, bucket, key);
        expect(entry.tokenCount).toBe(bucket.startTokens);
        expect(entry.lifetimeTokenCount).toBe(bucket.startTokens);
        expect(entry.invocationCount).toBe(0);
        expect(typeof entry.lastUpdated).toBe('number');
    });

    it('should check and allow if enough tokens', () => {
        const request: CheckRateLimitRequest = {
            bucketId,
            bucketType: 'simple',
            key,
            tokenRequest: 2,
            inquiry: false,
            bucketSize: 10,
            bucketRate: 1,
            invocationLimit: false,
            invocationLimitValue: 0
        };
        const res = bucketData.check(request);
        expect(res.success).toBe(true);
        expect(res.remaining).toBe(-1);
        expect(res.invocation).toBe(1);
    });

    it('should check and reject if not enough tokens', () => {
        // Use up all tokens
        const request: CheckRateLimitRequest = {
            bucketId,
            bucketType: 'simple',
            key,
            tokenRequest: 10,
            inquiry: false,
            bucketSize: 10,
            bucketRate: 1,
            invocationLimit: false,
            invocationLimitValue: 0
        };
        bucketData.check(request); // uses 5 tokens
        bucketData.check(request); // should fail
        const res = bucketData.check(request);
        expect(res.success).toBe(false);
        expect(res.rejectReason).toBe(RejectReason.RateLimit);
        expect(typeof res.next).toBe('number');
        expect(res.errorMessage).toMatch(/Insufficient tokens/);
    });

    it('should check and reject if invocation limit reached', () => {
        const request: CheckRateLimitRequest = {
            bucketId,
            bucketType: 'simple',
            key,
            tokenRequest: 1,
            inquiry: false,
            bucketSize: 10,
            bucketRate: 1,
            invocationLimit: true,
            invocationLimitValue: 1
        };
        bucketData.check(request); // first invocation
        const res = bucketData.check(request); // should fail
        expect(res.success).toBe(false);
        expect(res.rejectReason).toBe(RejectReason.InvocationLimit);
        expect(res.remaining).toBe(0);
        expect(res.errorMessage).toMatch(/Invocation limit reached/);
    });

    it('should delete a key', () => {
        bucketData.addTokens(bucketId, bucket, key);
        expect(bucketData.deleteKey(bucketId, key)).toBe(true);
        expect(bucketData.hasKey(bucketId, key)).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
        expect(bucketData.deleteKey(bucketId, 'notfound')).toBe(false);
    });

    it('should list keys', () => {
        bucketData.addTokens(bucketId, bucket, key);
        expect(bucketData.listKeys(bucketId)).toContain(key);
    });

    it('should set key data', () => {
        bucketData.addTokens(bucketId, bucket, key);
        const newData: BucketDataEntry = {
            tokenCount: 2,
            lifetimeTokenCount: 2,
            lastUpdated: now,
            invocationCount: 1
        };
        bucketData.setKey(bucketId, key, newData);
        expect(bucketData.getAllBucketData(bucketId)[key]).toEqual(newData);
    });

    it('should not set key for non-existent bucket', () => {
        const spy = jest.spyOn(require('../main').logger, 'error');
        bucketData.setKey('notfound', key, {
            tokenCount: 1,
            lifetimeTokenCount: 1,
            lastUpdated: now,
            invocationCount: 0
        });
        expect(spy).toHaveBeenCalled();
    });

    it('should persist only buckets with persistBucket=true', () => {
        const bucket2: Bucket = {
            name: 'bucket2',
            type: 'simple',
            maxTokens: 10,
            refillRate: 1,
            startTokens: 5,
            fillFromStart: false,
            persistBucket: false,
            lifetimeMaxTokens: false,
            lifetimeMaxTokensValue: 0
        };
        mockedBucketService.__setBuckets({
            [bucketId]: bucket,
            bucket2
        });
        bucketData.addTokens(bucketId, bucket, key);
        bucketData.addTokens('bucket2', bucket2, 'key2');
        const persistent = (bucketData as any).getPersistentBucketData();
        expect(Object.keys(persistent)).toContain(bucketId);
        expect(Object.keys(persistent)).not.toContain('bucket2');
    });

    it('should handle missing bucket in check gracefully', () => {
        const request: CheckRateLimitRequest = {
            bucketId: 'notfound',
            bucketType: 'simple',
            key,
            tokenRequest: 1,
            inquiry: false,
            bucketSize: 10,
            bucketRate: 1,
            invocationLimit: false,
            invocationLimitValue: 0
        };
        const res = bucketData.check(request);
        expect(res.success).toBe(true);
        expect(res.remaining).toBe(-1);
    });
});
