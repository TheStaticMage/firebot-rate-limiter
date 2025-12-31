import { expect, jest } from '@jest/globals';
import { ApprovalService } from './approval-service';
import { BucketService } from './bucket-service';
import { BucketData } from './bucket-data';

// Mock the logger
jest.mock('../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    },
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn().mockReturnValue(false),
                readFileSync: jest.fn().mockReturnValue('{}'),
                writeFileSync: jest.fn()
            },
            frontendCommunicator: {
                on: jest.fn(),
                send: jest.fn()
            }
        }
    }
}));

// Mock filesystem operations
jest.mock('./util', () => ({
    getDataFilePath: jest.fn(() => '/tmp/test-approval-service.json')
}));

describe('ApprovalService', () => {
    let approvalService: ApprovalService;
    let bucketService: BucketService;
    let bucketData: BucketData;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        bucketService = new BucketService();
        bucketData = new BucketData(Date.now());
        approvalService = new ApprovalService(bucketService, bucketData);

        const BucketServiceModule = require('./bucket-service');
        BucketServiceModule.bucketService = bucketService;
    });

    afterEach(() => {
        approvalService.shutdown();
        jest.useRealTimers();
    });

    describe('recordApproval', () => {
        it('should record an approval with all details', () => {
            const approvalId = 'test-approval-id';
            const bucketId = 'test-bucket';
            const bucketKey = 'user:testuser';
            const tokensConsumed = 10;
            const invocationIncremented = 1;

            approvalService.recordApproval(approvalId, bucketId, bucketKey, tokensConsumed, invocationIncremented);

            const approval = approvalService.getApproval(approvalId);
            expect(approval).not.toBeNull();
            expect(approval?.approvalId).toBe(approvalId);
            expect(approval?.bucketId).toBe(bucketId);
            expect(approval?.bucketKey).toBe(bucketKey);
            expect(approval?.tokensConsumed).toBe(tokensConsumed);
            expect(approval?.invocationIncremented).toBe(invocationIncremented);
            expect(approval?.timestamp).toBeGreaterThan(0);
        });

        it('should record inquiry checks with zero tokens consumed', () => {
            const approvalId = 'inquiry-approval';
            const bucketId = 'test-bucket';
            const bucketKey = 'user:testuser';

            approvalService.recordApproval(approvalId, bucketId, bucketKey, 0, 0);

            const approval = approvalService.getApproval(approvalId);
            expect(approval).not.toBeNull();
            expect(approval?.tokensConsumed).toBe(0);
            expect(approval?.invocationIncremented).toBe(0);
        });
    });

    describe('getApproval', () => {
        it('should return approval when it exists and is not expired', () => {
            const approvalId = 'valid-approval';
            approvalService.recordApproval(approvalId, 'bucket', 'key', 10, 1);

            const approval = approvalService.getApproval(approvalId);
            expect(approval).not.toBeNull();
            expect(approval?.approvalId).toBe(approvalId);
        });

        it('should return null for non-existent approval ID', () => {
            const approval = approvalService.getApproval('non-existent-id');
            expect(approval).toBeNull();
        });

        it('should return null for expired approval (> 10 minutes)', () => {
            const approvalId = 'expired-approval';
            approvalService.recordApproval(approvalId, 'bucket', 'key', 10, 1);

            jest.advanceTimersByTime(11 * 60 * 1000);

            const approval = approvalService.getApproval(approvalId);
            expect(approval).toBeNull();
        });

        it('should return approval just before expiration (< 10 minutes)', () => {
            const approvalId = 'almost-expired';
            approvalService.recordApproval(approvalId, 'bucket', 'key', 10, 1);

            jest.advanceTimersByTime(9 * 60 * 1000 + 59 * 1000);

            const approval = approvalService.getApproval(approvalId);
            expect(approval).not.toBeNull();
        });
    });

    describe('removeApproval', () => {
        it('should remove an existing approval', () => {
            const approvalId = 'to-remove';
            approvalService.recordApproval(approvalId, 'bucket', 'key', 10, 1);

            expect(approvalService.getApproval(approvalId)).not.toBeNull();

            approvalService.removeApproval(approvalId);

            expect(approvalService.getApproval(approvalId)).toBeNull();
        });

        it('should handle removing non-existent approval gracefully', () => {
            expect(() => {
                approvalService.removeApproval('non-existent');
            }).not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should automatically clean up expired approvals every 60 seconds', () => {
            approvalService.recordApproval('approval1', 'bucket', 'key', 10, 1);
            approvalService.recordApproval('approval2', 'bucket', 'key', 10, 1);

            jest.advanceTimersByTime(11 * 60 * 1000);

            approvalService.recordApproval('approval3', 'bucket', 'key', 10, 1);

            jest.advanceTimersByTime(60 * 1000);

            expect(approvalService.getApproval('approval1')).toBeNull();
            expect(approvalService.getApproval('approval2')).toBeNull();
            expect(approvalService.getApproval('approval3')).not.toBeNull();
        });
    });

    describe('undoApproval', () => {
        beforeEach(() => {
            bucketService.getBucket('test-bucket', { bucketSize: 100, bucketRate: 10 });
        });

        it('should successfully undo a valid approval', () => {
            const approvalId = 'undo-test';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 20,
                inquiry: false,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            const beforeData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            const beforeInvocations = beforeData.invocationCount;

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 20, 1);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(true);
            expect(result.details?.tokensRestored).toBeGreaterThanOrEqual(0);
            expect(result.details?.invocationDecremented).toBe(1);

            const afterData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            expect(afterData.invocationCount).toBe(beforeInvocations - 1);
        });

        it('should fail with invalid_or_expired for non-existent approval ID', () => {
            const result = approvalService.undoApproval('non-existent');

            expect(result.success).toBe(false);
            expect(result.reason).toBe('invalid_or_expired');
        });

        it('should fail with invalid_or_expired for expired approval', () => {
            const approvalId = 'expired-undo';
            approvalService.recordApproval(approvalId, 'test-bucket', 'user:test', 10, 1);

            jest.advanceTimersByTime(11 * 60 * 1000);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('invalid_or_expired');
        });

        it('should fail with bucket_not_found for missing bucket', () => {
            const approvalId = 'no-bucket';
            approvalService.recordApproval(approvalId, 'non-existent-bucket', 'user:test', 10, 1);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('bucket_not_found');
        });

        it('should fail with key_not_found for missing bucket key', () => {
            const approvalId = 'no-key';
            approvalService.recordApproval(approvalId, 'test-bucket', 'user:nonexistent', 10, 1);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('key_not_found');
        });

        it('should cap tokens at bucket maximum during undo', () => {
            const approvalId = 'cap-test';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 10,
                inquiry: false,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            const bucket = bucketService.getBucket('test-bucket');
            if (!bucket) {
                throw new Error('Bucket not found');
            }
            const beforeData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            beforeData.tokenCount = bucket.maxTokens - 5;
            bucketData.setKey('test-bucket', bucketKey, beforeData);

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 10, 1);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(true);

            const afterData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            expect(afterData.tokenCount).toBeLessThanOrEqual(bucket.maxTokens);
        });

        it('should remove approval after successful undo', () => {
            const approvalId = 'remove-after-undo';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 10,
                inquiry: false,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 10, 1);

            expect(approvalService.getApproval(approvalId)).not.toBeNull();

            approvalService.undoApproval(approvalId);

            expect(approvalService.getApproval(approvalId)).toBeNull();
        });

        it('should prevent double undo of same approval ID', () => {
            const approvalId = 'double-undo';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 10,
                inquiry: false,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 10, 1);

            const firstUndo = approvalService.undoApproval(approvalId);
            expect(firstUndo.success).toBe(true);

            const secondUndo = approvalService.undoApproval(approvalId);
            expect(secondUndo.success).toBe(false);
            expect(secondUndo.reason).toBe('invalid_or_expired');
        });

        it('should correctly decrement invocation count', () => {
            const approvalId = 'invocation-test';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 10,
                inquiry: false,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            const beforeData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            const beforeInvocations = beforeData.invocationCount;

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 10, 1);

            approvalService.undoApproval(approvalId);

            const afterData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            expect(afterData.invocationCount).toBe(beforeInvocations - 1);
        });

        it('should handle inquiry undo correctly (0 tokens, 0 invocations)', () => {
            const approvalId = 'inquiry-undo';
            const bucketKey = 'user:testuser';

            bucketData.check({
                bucketType: 'simple',
                bucketId: 'test-bucket',
                bucketSize: 100,
                bucketRate: 10,
                key: bucketKey,
                tokenRequest: 10,
                inquiry: true,
                invocationLimit: false,
                invocationLimitValue: 0
            });

            const beforeData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            const beforeTokens = beforeData.tokenCount;
            const beforeInvocations = beforeData.invocationCount;

            approvalService.recordApproval(approvalId, 'test-bucket', bucketKey, 0, 0);

            const result = approvalService.undoApproval(approvalId);

            expect(result.success).toBe(true);
            expect(result.details?.tokensRestored).toBe(0);
            expect(result.details?.invocationDecremented).toBe(0);

            const afterData = bucketData.getAllBucketData('test-bucket')[bucketKey];
            expect(afterData.tokenCount).toBe(beforeTokens);
            expect(afterData.invocationCount).toBe(beforeInvocations);
        });
    });

    describe('shutdown', () => {
        it('should clear cleanup interval and all approvals', () => {
            approvalService.recordApproval('test1', 'bucket', 'key', 10, 1);
            approvalService.recordApproval('test2', 'bucket', 'key', 10, 1);

            expect(approvalService.getApproval('test1')).not.toBeNull();

            approvalService.shutdown();

            jest.advanceTimersByTime(60 * 1000);

            expect(approvalService.getApproval('test1')).toBeNull();
            expect(approvalService.getApproval('test2')).toBeNull();
        });
    });
});
