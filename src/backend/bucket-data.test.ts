import { Bucket, BucketDataEntry, CheckRateLimitRequest, RejectReason } from '../shared/types';
import { BucketData } from './bucket-data';

jest.mock('../main', () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
            },
            frontendCommunicator: {
                on: jest.fn(),
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
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
        fillBucketAcrossRestarts: false,
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
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('parseFileData', () => {
        // Test-only subclass to expose private parseFileData
        class TestableBucketData extends BucketData {
            public parseFileDataPublic(data: string) {
            // @ts-expect-error: access private method for testing
                return this.parseFileData(data);
            }
        }

        it('should correctly parse file data with and without fillBucketAcrossRestarts', () => {
            // Mock getBucket to return buckets with and without fillBucketAcrossRestarts
            const testBucketId1 = 'bucket1';
            const testBucketId2 = 'bucket2';
            const entry = {
                tokenCount: 5,
                lifetimeTokenCount: 5,
                lastUpdated: 12345,
                invocationCount: 2
            };

            mockedBucketService.__setBuckets({
                [testBucketId1]: { fillBucketAcrossRestarts: true },
                [testBucketId2]: { fillBucketAcrossRestarts: false }
            });

            const data = JSON.stringify({
                [testBucketId1]: { user1: { ...entry } },
                [testBucketId2]: { user2: { ...entry } }
            });
            const tbd = new TestableBucketData();
            const result = tbd.parseFileDataPublic(data);
            // bucket1 should keep lastUpdated, bucket2 should set lastUpdated to 0
            expect(result[testBucketId1].user1.lastUpdated).toBe(12345);
            expect(result[testBucketId2].user2.lastUpdated).toBe(0);
        });
    });

    describe('addTokens', () => {
        it('should not exceed lifetimeMaxTokens when adding tokens', () => {
            const lifetimeBucket: Bucket = {
                name: 'lifetime',
                type: 'simple',
                maxTokens: 10,
                refillRate: 100, // high refill rate to test cap
                startTokens: 5,
                fillFromStart: false,
                persistBucket: true,
                fillBucketAcrossRestarts: false,
                lifetimeMaxTokens: true,
                lifetimeMaxTokensValue: 7
            };
            mockedBucketService.__setBuckets({
                lifetime: lifetimeBucket
            });
            const bucketData = new BucketData();
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
                lifetimeMaxTokensValue: 0,
                fillBucketAcrossRestarts: false
            };
            mockedBucketService.__setBuckets({
                fill: fillBucket
            });
            // Simulate 5 seconds since start
            const fiveSecondsAgo = now;
            const nowPlus5s = now + 5000;
            jest.setSystemTime(nowPlus5s);
            const bucketData = new BucketData(fiveSecondsAgo);
            // The first addTokens should initialize with fillTokens = refillRate * (now - startTime) / 1000
            // But since startTokens is 0, should be 2 * 5 = 10 tokens
            const entry = bucketData.addTokens('fill', fillBucket, key);
            expect(entry.tokenCount).toBe(10);
            expect(entry.lifetimeTokenCount).toBe(10);
        });

        it('should initialize and load empty data', () => {
            const bucketData = new BucketData();
            expect(bucketData.getAllBucketData(bucketId)).toEqual({});
        });

        it('should add tokens and update bucket data', () => {
            const bucketData = new BucketData();
            const entry = bucketData.addTokens(bucketId, bucket, key);
            expect(entry.tokenCount).toBe(bucket.startTokens);
            expect(entry.lifetimeTokenCount).toBe(bucket.startTokens);
            expect(entry.invocationCount).toBe(0);
            expect(typeof entry.lastUpdated).toBe('number');
        });
    });

    describe('check', () => {
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
            const bucketData = new BucketData();
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
            const bucketData = new BucketData();
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
            const bucketData = new BucketData();
            bucketData.check(request); // first invocation
            const res = bucketData.check(request); // should fail
            expect(res.success).toBe(false);
            expect(res.rejectReason).toBe(RejectReason.InvocationLimit);
            expect(res.remaining).toBe(0);
            expect(res.errorMessage).toMatch(/Invocation limit reached/);
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
            const bucketData = new BucketData();
            const res = bucketData.check(request);
            expect(res.success).toBe(true);
            expect(res.remaining).toBe(-1);
        });
    });

    describe('deleteKey', () => {
        it('should delete a key', () => {
            const bucketData = new BucketData();
            bucketData.addTokens(bucketId, bucket, key);
            expect(bucketData.deleteKey(bucketId, key)).toBe(true);
            expect(bucketData.hasKey(bucketId, key)).toBe(false);
        });

        it('should return false when deleting non-existent key', () => {
            const bucketData = new BucketData();
            expect(bucketData.deleteKey(bucketId, 'notfound')).toBe(false);
        });
    });

    describe('listKeys', () => {
        it('should list keys', () => {
            const bucketData = new BucketData();
            bucketData.addTokens(bucketId, bucket, key);
            expect(bucketData.listKeys(bucketId)).toContain(key);
        });
    });

    describe('setKey', () => {
        it('should set key data', () => {
            const bucketData = new BucketData();
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
            const bucketData = new BucketData();
            bucketData.setKey('notfound', key, {
                tokenCount: 1,
                lifetimeTokenCount: 1,
                lastUpdated: now,
                invocationCount: 0
            });
            expect(spy).toHaveBeenCalled();
        });
    });

    describe('getPersistentBucketData', () => {
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
                lifetimeMaxTokensValue: 0,
                fillBucketAcrossRestarts: false
            };
            mockedBucketService.__setBuckets({
                [bucketId]: bucket,
                bucket2
            });
            const bucketData = new BucketData();
            bucketData.addTokens(bucketId, bucket, key);
            bucketData.addTokens('bucket2', bucket2, 'key2');
            const persistent = (bucketData as any).getPersistentBucketData();
            expect(Object.keys(persistent)).toContain(bucketId);
            expect(Object.keys(persistent)).not.toContain('bucket2');
        });

        describe('handleSaveBucketDataEvent', () => {
            let bucketData: BucketData;
            let testBucketData: any;

            beforeEach(() => {
                mockedBucketService.__setBuckets({
                    [bucketId]: bucket
                });
                bucketData = new BucketData();
                testBucketData = {
                    user1: {
                        tokenCount: 5,
                        lifetimeTokenCount: 10,
                        lastUpdated: Date.now(),
                        invocationCount: 2
                    },
                    user2: {
                        tokenCount: 3,
                        lifetimeTokenCount: 8,
                        lastUpdated: Date.now(),
                        invocationCount: 1
                    }
                };
            });

            it('should successfully save valid bucket data', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(testBucketData),
                    dryRun: false
                });

                expect(result.success).toBe(true);
                expect(result.errorMessage).toBeUndefined();
                expect(bucketData.getAllBucketData(bucketId)).toEqual(testBucketData);
            });

            it('should validate without saving in dry run mode', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(testBucketData),
                    dryRun: true
                });

                expect(result.success).toBe(true);
                expect(result.errorMessage).toBeUndefined();
                expect(bucketData.getAllBucketData(bucketId)).toEqual({});
            });

            it('should return error for non-existent bucket', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId: 'nonexistent',
                    bucketData: JSON.stringify(testBucketData),
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('No bucket found');
            });

            it('should return error for invalid JSON', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: 'invalid json {',
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('Invalid JSON');
            });

            it('should return error for non-object bucket data', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: '"string value"',
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('expected object but got string');
            });

            it('should return error for array bucket data', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: '[1, 2, 3]',
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('expected object but got object');
            });

            it('should return error for entry with missing tokenCount', () => {
                const invalidData = {
                    user1: {
                        lifetimeTokenCount: 10,
                        lastUpdated: Date.now(),
                        invocationCount: 2
                    }
                };

                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(invalidData),
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('Invalid bucketData for user1');
                expect(result.errorMessage).toContain('tokenCount is not a number');
            });

            it('should return error for entry with wrong type fields', () => {
                const invalidData = {
                    user1: {
                        tokenCount: 'five',
                        lifetimeTokenCount: 'ten',
                        lastUpdated: 'yesterday',
                        invocationCount: 'two'
                    }
                };

                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(invalidData),
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('Invalid bucketData for user1');
                expect(result.errorMessage).toContain('tokenCount is not a number (got string)');
                expect(result.errorMessage).toContain('lifetimeTokenCount is not a number (got string)');
                expect(result.errorMessage).toContain('lastUpdated is not a number (got string)');
                expect(result.errorMessage).toContain('invocationCount is not a number (got string)');
            });

            it('should return error for null entry', () => {
                const invalidData = {
                    user1: null
                };

                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(invalidData),
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('Invalid bucketData for user1');
                expect(result.errorMessage).toContain('entry is not an object (got object)');
            });

            it('should allow dry run validation without bucket ID', () => {
                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId: '',
                    bucketData: JSON.stringify(testBucketData),
                    dryRun: true
                });

                expect(result.success).toBe(true);
                expect(result.errorMessage).toBeUndefined();
            });

            it('should return specific error message identifying problematic key', () => {
                const mixedData = {
                    validUser: {
                        tokenCount: 5,
                        lifetimeTokenCount: 10,
                        lastUpdated: Date.now(),
                        invocationCount: 2
                    },
                    invalidUser: {
                        tokenCount: 'not a number',
                        lifetimeTokenCount: 10,
                        lastUpdated: Date.now(),
                        invocationCount: 2
                    }
                };

                const result = (bucketData as any).handleSaveBucketDataEvent({
                    bucketId,
                    bucketData: JSON.stringify(mixedData),
                    dryRun: false
                });

                expect(result.success).toBe(false);
                expect(result.errorMessage).toContain('Invalid bucketData for invalidUser');
                expect(result.errorMessage).toContain('tokenCount is not a number');
            });
        });
    });
});
