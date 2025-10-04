import { expect, jest } from '@jest/globals';
import { BucketData } from '../backend/bucket-data';
import { BucketService } from '../backend/bucket-service';
import { checkEffect } from './check';

// Mock the logger to avoid actual logging during tests
jest.mock('../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    },
    firebot: {
        firebot: {
            accounts: {
                streamer: {
                    username: 'streamer'
                },
                bot: {
                    username: 'bot'
                }
            }
        },
        modules: {
            twitchApi: {
                channelRewards: {
                    approveOrRejectChannelRewardRedemption: jest.fn()
                }
            },
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

// Mock the events module
jest.mock('../events', () => ({
    emitEvent: jest.fn()
}));

// Mock filesystem operations
jest.mock('../backend/util', () => ({
    getDataFilePath: jest.fn(() => '/tmp/test-bucket-data.json')
}));

describe('checkEffect.onTriggerEvent', () => {
    let bucketData: BucketData;
    let bucketService: BucketService;
    let mockTwitchApi: jest.MockedFunction<any>;
    let mockEmitEvent: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mocks
        const { firebot } = require('../main');
        mockTwitchApi = firebot.modules.twitchApi.channelRewards.approveOrRejectChannelRewardRedemption;
        mockEmitEvent = require('../events').emitEvent;

        // Create actual bucket service and data instances for testing
        bucketService = new BucketService();

        // Set the global bucket service variable first
        const BucketServiceModule = require('../backend/bucket-service');
        BucketServiceModule.bucketService = bucketService;

        // Now create bucket data (which will use the global bucketService)
        bucketData = new BucketData(Date.now());

        // Patch bucket data to use our instances
        const BucketDataModule = require('../backend/bucket-data');
        BucketDataModule.bucketData = bucketData;
    });

    it('should allow request when tokens are available', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 10,
            bucketRate: 1,
            keyType: 'user' as const,
            key: '',
            tokens: 5,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false,
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser'
            }
        };

        const result = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'outputs' in result) {
            expect(result.outputs?.rateLimitAllowed).toBe('true');
            expect(result.execution?.stop).toBe(false);
        }
    });

    it('should reject request when tokens are not available', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 1,
            bucketRate: 0.1,
            keyType: 'user' as const,
            key: '',
            tokens: 10, // Request more than available
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false,
            stopExecution: true,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser'
            }
        };

        const result = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'outputs' in result) {
            expect(result.outputs?.rateLimitAllowed).toBe('false');
            expect(result.execution?.stop).toBe(true);
            expect(result.outputs?.rateLimitRejectReason).toBe('rate_limit');
        }
    });

    it('should skip rate limiting for streamer when enforceStreamer is false', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 1,
            bucketRate: 0.1,
            keyType: 'user' as const,
            key: '',
            tokens: 10, // More than available
            inquiry: false,
            enforceStreamer: false, // Skip enforcement for streamer
            enforceBot: true,
            rejectReward: false,
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'streamer' // This is the streamer username from our mock
            }
        };

        const result = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'outputs' in result) {
            expect(result.outputs?.rateLimitAllowed).toBe('true');
        }
    });

    it('should trigger approved event when enabled and request passes', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 10,
            bucketRate: 1,
            keyType: 'user' as const,
            key: '',
            tokens: 5,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false,
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: true, // Enable approved event
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser',
                chatMessage: { id: 'msg123' }
            }
        };

        await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(mockEmitEvent).toHaveBeenCalledWith('approved', expect.objectContaining({
            alwaysAllow: false,
            success: true,
            bucketId: 'test-effect',
            bucketKey: 'user:testuser',
            username: 'testuser',
            messageId: 'msg123'
        }), false);
    });

    it('should reject channel point reward when enabled and limit exceeded', async () => {
        mockTwitchApi.mockResolvedValue(true);

        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 1,
            bucketRate: 0.1,
            keyType: 'user' as const,
            key: '',
            tokens: 10,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: true, // Enable reward rejection
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser',
                eventData: {
                    redemptionId: 'redemption123',
                    rewardId: 'reward456'
                }
            }
        };

        await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(mockTwitchApi).toHaveBeenCalledWith({
            rewardId: 'reward456',
            redemptionIds: ['redemption123'],
            approve: false
        });
    });

    it('should not reject channel point reward when disabled and limit exceeded', async () => {
        mockTwitchApi.mockResolvedValue(true);

        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 1,
            bucketRate: 0.1,
            keyType: 'user' as const,
            key: '',
            tokens: 10,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false, // Disable reward rejection
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser',
                eventData: {
                    redemptionId: 'redemption123',
                    rewardId: 'reward456'
                }
            }
        };

        await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(mockTwitchApi).not.toHaveBeenCalledWith({
            rewardId: 'reward456',
            redemptionIds: ['redemption123'],
            approve: false
        });
    });

    it('should reject when invocation limit is exceeded', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 100, // Plenty of tokens
            bucketRate: 10,
            keyType: 'user' as const,
            key: '',
            tokens: 1,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false,
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: true,
            invocationLimitValue: 2
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser'
            }
        };

        // First call - should succeed
        const result1 = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        if (result1 && typeof result1 === 'object' && 'outputs' in result1) {
            expect(result1.outputs?.rateLimitAllowed).toBe('true');
        }

        // Second call - should succeed
        const result2 = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        if (result2 && typeof result2 === 'object' && 'outputs' in result2) {
            expect(result2.outputs?.rateLimitAllowed).toBe('true');
        }

        // Third call - should fail due to invocation limit
        const result3 = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        if (result3 && typeof result3 === 'object' && 'outputs' in result3) {
            expect(result3.outputs?.rateLimitAllowed).toBe('false');
            expect(result3.outputs?.rateLimitRejectReason).toBe('invocation_limit');
        }
    });

    it('should provide correct output values for successful request', async () => {
        const effect = {
            id: 'test-effect',
            bucketId: 'test-bucket-id',
            bucketType: 'simple' as const,
            bucketSize: 10,
            bucketRate: 1,
            keyType: 'user' as const,
            key: '',
            tokens: 5,
            inquiry: false,
            enforceStreamer: true,
            enforceBot: true,
            rejectReward: false,
            stopExecution: false,
            stopExecutionBubble: false,
            triggerEvent: false,
            triggerApproveEvent: false,
            rateLimitMetadata: '',
            invocationLimit: false,
            invocationLimitValue: 0
        };

        const trigger = {
            type: 'command' as const,
            metadata: {
                username: 'testuser'
            }
        };

        const result = await checkEffect.onTriggerEvent({
            effect,
            trigger,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            sendDataToOverlay: () => {},
            abortSignal: new AbortController().signal
        });

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'outputs' in result) {
            expect(result.outputs?.rateLimitAllowed).toBe('true');
            expect(typeof result.outputs?.rateLimitNext).toBe('number');
            expect(typeof result.outputs?.rateLimitInvocation).toBe('number');
            expect(result.outputs?.rateLimitRemaining).toBe(-1); // No invocation limit
            expect(result.outputs?.rateLimitErrorMessage).toBe('');
            expect(result.outputs?.rateLimitRejectReason).toBe('');
            expect(result.outputs?.rateLimitRawObject).toHaveProperty('request');
            expect(result.outputs?.rateLimitRawObject).toHaveProperty('response');
        }
    });
});
