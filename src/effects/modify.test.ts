/* eslint-disable @typescript-eslint/unbound-method */
import { expect, jest } from '@jest/globals';
import { BucketData } from '../backend/bucket-data';
import { BucketService } from '../backend/bucket-service';
import { modifyEffectModel, processTrigger, NonCriticalError } from './modify';
import * as BucketDataModule from '../backend/bucket-data';
import * as BucketServiceModule from '../backend/bucket-service';

// Mock the logger to avoid actual logging during tests
jest.mock('../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

describe('processTrigger', () => {
    let baseEffect: modifyEffectModel;
    let baseBucketData: jest.Mocked<BucketData>;
    let baseBucketService: jest.Mocked<BucketService>;

    beforeEach(() => {
        baseEffect = {
            id: 'test-id',
            bucketId: 'bucket1',
            keyType: 'user',
            userKey: 'alice',
            customKey: '',
            action: 'modify',
            createMissing: false,
            currentTokenOperation: 'noChange',
            currentTokenValue: 0,
            lifetimeTokenOperation: 'noChange',
            lifetimeTokenValue: 0,
            invocationOperation: 'noChange',
            invocationValue: 0,
            lastUpdatedOperation: 'noChange',
            lastUpdatedValue: 0
        };
        // Create fresh mocks for each test
        baseBucketData = {
            getAllBucketData: jest.fn().mockReturnValue({}),
            listKeys: jest.fn().mockReturnValue([]),
            hasKey: jest.fn().mockReturnValue(true),
            addTokens: jest.fn((_bucketId, _bucket, key) => ({
                tokenCount: 10,
                lifetimeTokenCount: 100,
                invocationCount: 5,
                lastUpdated: 1000,
                key
            })),
            setKey: jest.fn(),
            deleteKey: jest.fn().mockReturnValue(true)
        } as unknown as jest.Mocked<BucketData>;

        baseBucketService = {
            getAdvancedBucketsEnabled: jest.fn().mockReturnValue(true),
            getBucket: jest.fn().mockReturnValue({
                name: 'Bucket 1',
                type: 'advanced',
                startTokens: 10,
                maxTokens: 100,
                refillRate: 1,
                lifetimeMaxTokens: false,
                lifetimeMaxTokensValue: 0,
                persistBucket: true,
                fillFromStart: false
            })
        } as unknown as jest.Mocked<BucketService>;

        // Mock the module exports to return our mocks
        jest.spyOn(BucketDataModule, 'BucketData').mockReturnValue(baseBucketData);
        jest.spyOn(BucketServiceModule, 'BucketService').mockReturnValue(baseBucketService);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not change values when all operations are noChange for allusers', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            currentTokenOperation: 'noChange',
            lifetimeTokenOperation: 'noChange',
            invocationOperation: 'noChange',
            lastUpdatedOperation: 'noChange'
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(2);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                tokenCount: 10,
                lifetimeTokenCount: 100,
                invocationCount: 5,
                lastUpdated: 1000
            })
        );
    });

    it('does not change values when all operations are noChange for allkeys', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            currentTokenOperation: 'noChange',
            lifetimeTokenOperation: 'noChange',
            invocationOperation: 'noChange',
            lastUpdatedOperation: 'noChange'
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo', 'global']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(3);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                tokenCount: 10,
                lifetimeTokenCount: 100,
                invocationCount: 5,
                lastUpdated: 1000
            })
        );
    });

    it('does not change values when all operations are noChange for custom', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            currentTokenOperation: 'noChange',
            lifetimeTokenOperation: 'noChange',
            invocationOperation: 'noChange',
            lastUpdatedOperation: 'noChange',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'custom:foo',
            expect.objectContaining({
                tokenCount: 10,
                lifetimeTokenCount: 100,
                invocationCount: 5,
                lastUpdated: 1000
            })
        );
    });

    it('does not change values when all operations are noChange for global', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            currentTokenOperation: 'noChange',
            lifetimeTokenOperation: 'noChange',
            invocationOperation: 'noChange',
            lastUpdatedOperation: 'noChange',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'global',
            expect.objectContaining({
                tokenCount: 10,
                lifetimeTokenCount: 100,
                invocationCount: 5,
                lastUpdated: 1000
            })
        );
    });

    it('handles negative and zero values for add/set operations', () => {
        // Add negative tokens
        let effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'alice',
            currentTokenOperation: 'add',
            currentTokenValue: -5,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        let result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({ tokenCount: 5 }) // 10 - 5
        );

        // Set tokens to zero
        effect = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'alice',
            currentTokenOperation: 'set',
            currentTokenValue: 0,
            createMissing: true
        };
        result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({ tokenCount: 0 })
        );
    });

    it('combines multiple operations for allusers', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            currentTokenOperation: 'add',
            currentTokenValue: 1,
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 2,
            invocationOperation: 'set',
            invocationValue: 99,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 111
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                tokenCount: 11,
                lifetimeTokenCount: 102,
                invocationCount: 99,
                lastUpdated: 111000
            })
        );
    });

    it('combines multiple operations for allkeys', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            currentTokenOperation: 'add',
            currentTokenValue: 1,
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 2,
            invocationOperation: 'set',
            invocationValue: 99,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 111
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo', 'global']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                tokenCount: 11,
                lifetimeTokenCount: 102,
                invocationCount: 99,
                lastUpdated: 111000
            })
        );
    });

    it('combines multiple operations for custom', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            currentTokenOperation: 'add',
            currentTokenValue: 1,
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 2,
            invocationOperation: 'set',
            invocationValue: 99,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 111,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'custom:foo',
            expect.objectContaining({
                tokenCount: 11,
                lifetimeTokenCount: 102,
                invocationCount: 99,
                lastUpdated: 111000
            })
        );
    });

    it('combines multiple operations for global', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            currentTokenOperation: 'add',
            currentTokenValue: 1,
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 2,
            invocationOperation: 'set',
            invocationValue: 99,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 111,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'global',
            expect.objectContaining({
                tokenCount: 11,
                lifetimeTokenCount: 102,
                invocationCount: 99,
                lastUpdated: 111000
            })
        );
    });

    it('deletes all keys (allkeys)', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            action: 'delete'
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo', 'global']);
        baseBucketData.deleteKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'user:alice');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'custom:foo');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'global');
    });

    it('deletes the global key', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            action: 'delete',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'global');
    });

    it('does not throw if createMissing is true for allusers and some keys are missing', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            createMissing: true
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob']);
        baseBucketData.hasKey.mockReturnValueOnce(true).mockReturnValueOnce(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).not.toThrow();
    });

    it('does not throw if createMissing is true for allkeys and some keys are missing', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            createMissing: true
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo']);
        baseBucketData.hasKey.mockReturnValueOnce(true).mockReturnValueOnce(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).not.toThrow();
    });

    it('returns error message in NonCriticalError', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: '',
            createMissing: false
        };
        try {
            processTrigger(effect, baseBucketData, baseBucketService);
        } catch (err) {
            expect(err).toBeInstanceOf(NonCriticalError);
            expect((err as Error).message).toMatch(/User key is required/);
        }
    });

    it('propagates error from setKey', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'alice',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        baseBucketData.setKey.mockImplementation(() => {
            throw new Error('setKey failed');
        });
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow('setKey failed');
    });

    it('propagates error from deleteKey', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'alice',
            action: 'delete',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(true);
        baseBucketData.deleteKey.mockImplementation(() => {
            throw new Error('deleteKey failed');
        });
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow('deleteKey failed');
    });

    it('modifies all user keys with add operation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            currentTokenOperation: 'add',
            currentTokenValue: 2
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob', 'custom:foo']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(2);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({ tokenCount: 12 })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:bob',
            expect.objectContaining({ tokenCount: 12 })
        );
    });

    it('modifies all user keys with lifetimeTokenOperation, invocationOperation, and lastUpdatedOperation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            lifetimeTokenOperation: 'set',
            lifetimeTokenValue: 500,
            invocationOperation: 'add',
            invocationValue: 3,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 456
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob', 'custom:foo']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(2);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                lifetimeTokenCount: 500,
                invocationCount: 8, // 5 + 3
                lastUpdated: 456000
            })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:bob',
            expect.objectContaining({
                lifetimeTokenCount: 500,
                invocationCount: 8,
                lastUpdated: 456000
            })
        );
    });

    it('modifies all keys with set operation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            currentTokenOperation: 'set',
            currentTokenValue: 99
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo', 'global']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(3);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({ tokenCount: 99 })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'custom:foo',
            expect.objectContaining({ tokenCount: 99 })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'global',
            expect.objectContaining({ tokenCount: 99 })
        );
    });

    it('modifies all keys with lifetimeTokenOperation, invocationOperation, and lastUpdatedOperation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys',
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 50,
            invocationOperation: 'set',
            invocationValue: 42,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 789
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'custom:foo', 'global']);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledTimes(3);
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                lifetimeTokenCount: 150, // 100 + 50
                invocationCount: 42,
                lastUpdated: 789000
            })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'custom:foo',
            expect.objectContaining({
                lifetimeTokenCount: 150,
                invocationCount: 42,
                lastUpdated: 789000
            })
        );
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'global',
            expect.objectContaining({
                lifetimeTokenCount: 150,
                invocationCount: 42,
                lastUpdated: 789000
            })
        );
    });

    it('deletes all user keys', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers',
            action: 'delete'
        };
        baseBucketData.listKeys.mockReturnValue(['user:alice', 'user:bob']);
        baseBucketData.deleteKey.mockReturnValueOnce(true).mockReturnValueOnce(false);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'user:alice');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'user:bob');
    });

    it('deletes a custom key', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            action: 'delete',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.deleteKey).toHaveBeenCalledWith(effect.bucketId, 'custom:foo');
    });

    it('modifies a custom key with lifetimeTokenOperation, invocationOperation, and lastUpdatedOperation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            lifetimeTokenOperation: 'set',
            lifetimeTokenValue: 321,
            invocationOperation: 'add',
            invocationValue: 7,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 654,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'custom:foo',
            expect.objectContaining({
                lifetimeTokenCount: 321,
                invocationCount: 12, // 5 + 7
                lastUpdated: 654000
            })
        );
    });

    it('throws NonCriticalError if user keyType is missing userKey', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: '',
            createMissing: false
        };
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('throws NonCriticalError if custom keyType is missing customKey', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: '',
            createMissing: false
        };
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('modifies a user key with all operations', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'alice',
            currentTokenOperation: 'add',
            currentTokenValue: 5,
            lifetimeTokenOperation: 'set',
            lifetimeTokenValue: 200,
            invocationOperation: 'add',
            invocationValue: 2,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 123,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'user:alice',
            expect.objectContaining({
                tokenCount: 15, // 10 + 5
                lifetimeTokenCount: 200,
                invocationCount: 7, // 5 + 2
                lastUpdated: 123000 // set to 123 * 1000
            })
        );
    });

    it('throws if advanced buckets are not enabled', () => {
        jest.spyOn(baseBucketService, 'getAdvancedBucketsEnabled').mockReturnValue(false);
        expect(() => processTrigger(baseEffect, baseBucketData, baseBucketService)).toThrow(/Advanced buckets are not enabled/);
    });

    it('throws if the bucket is not found', () => {
        jest.spyOn(baseBucketService, 'getBucket').mockReturnValue(undefined);
        expect(() => processTrigger(baseEffect, baseBucketData, baseBucketService)).toThrow(/Bucket not found/);
    });

    it('processes a valid modify effect', () => {
        const result = processTrigger(baseEffect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe("true");
        expect(result.rateLimitModifyBucketDataRawObject).toEqual({});
    });

    it ('processes a valid delete effect', () => {
        const deleteEffect: modifyEffectModel = {
            ...baseEffect,
            action: 'delete'
        };
        const result = processTrigger(deleteEffect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe("true");
        expect(result.rateLimitModifyBucketDataRawObject).toEqual({});
    });

    it('throws NonCriticalError if keyType is allusers but there are no user keys in the bucket', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allusers'
        };
        // listKeys returns keys, but none start with 'user:'
        baseBucketData.listKeys = jest.fn(() => ['custom:foo', 'global']);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('throws NonCriticalError if keyType is user and key does not exist and createMissing is false', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'bob',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('does not throw if keyType is user and key does not exist but createMissing is true', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'user',
            userKey: 'bob',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).not.toThrow();
    });

    it('throws NonCriticalError if keyType is custom and key does not exist and createMissing is false', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('does not throw if keyType is custom and key does not exist but createMissing is true', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'custom',
            customKey: 'foo',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).not.toThrow();
    });

    it('throws NonCriticalError if keyType is global and key does not exist and createMissing is false', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            createMissing: false
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });

    it('does not throw if keyType is global and key does not exist but createMissing is true', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(false);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).not.toThrow();
    });

    it('modifies a global key with lifetimeTokenOperation, invocationOperation, and lastUpdatedOperation', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'global',
            lifetimeTokenOperation: 'add',
            lifetimeTokenValue: 11,
            invocationOperation: 'set',
            invocationValue: 77,
            lastUpdatedOperation: 'set',
            lastUpdatedValue: 222,
            createMissing: true
        };
        baseBucketData.hasKey.mockReturnValue(true);
        const result = processTrigger(effect, baseBucketData, baseBucketService);
        expect(result.rateLimitModifyBucketDataSuccess).toBe('true');
        expect(baseBucketData.setKey).toHaveBeenCalledWith(
            effect.bucketId,
            'global',
            expect.objectContaining({
                lifetimeTokenCount: 111, // 100 + 11
                invocationCount: 77,
                lastUpdated: 222000
            })
        );
    });

    it('throws NonCriticalError if keyType is allkeys but there are no keys in the bucket', () => {
        const effect: modifyEffectModel = {
            ...baseEffect,
            keyType: 'allkeys'
        };
        baseBucketData.listKeys.mockReturnValue([]);
        expect(() => processTrigger(effect, baseBucketData, baseBucketService)).toThrow(NonCriticalError);
    });


});
