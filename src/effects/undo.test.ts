/* eslint-disable @typescript-eslint/unbound-method */

import { expect, jest } from '@jest/globals';
import { ApprovalService } from '../backend/approval-service';
import { undoEffect } from './undo';

// Mock the logger and approval service
jest.mock('../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    },
    approvalService: {
        undoApproval: jest.fn()
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
jest.mock('../backend/util', () => ({
    getDataFilePath: jest.fn(() => '/tmp/test-undo-effect.json')
}));

describe('undoEffect.onTriggerEvent', () => {
    let mockApprovalService: jest.Mocked<ApprovalService>;

    beforeEach(() => {
        jest.clearAllMocks();
        const main = require('../main');
        mockApprovalService = main.approvalService as jest.Mocked<ApprovalService>;
    });

    it('should successfully undo with valid approval ID', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: true,
            details: {
                tokensRestored: 10,
                invocationDecremented: 1
            }
        });

        const effect = {
            approvalId: 'valid-approval-id'
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        const undoApprovalSpy = mockApprovalService.undoApproval;

        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('true');
            expect(outputs.rateLimitUndoReason).toBe('');
        }
        expect(undoApprovalSpy).toHaveBeenCalledWith('valid-approval-id');
    });

    it('should fail with invalid_or_expired for non-existent approval ID', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: false,
            reason: 'invalid_or_expired'
        });

        const effect = {
            approvalId: 'non-existent-id'
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('invalid_or_expired');
        }
    });

    it('should fail with bucket_not_found when bucket does not exist', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: false,
            reason: 'bucket_not_found'
        });

        const effect = {
            approvalId: 'approval-no-bucket'
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('bucket_not_found');
        }
    });

    it('should fail with key_not_found when bucket key does not exist', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: false,
            reason: 'key_not_found'
        });

        const effect = {
            approvalId: 'approval-no-key'
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('key_not_found');
        }
    });

    it('should handle empty approval ID', async () => {
        const effect = {
            approvalId: ''
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('empty_approval_id');
        }
        const undoApprovalSpy = mockApprovalService.undoApproval;
        expect(undoApprovalSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle whitespace-only approval ID', async () => {
        const effect = {
            approvalId: '   '
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        const undoApprovalSpy2 = mockApprovalService.undoApproval;

        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('empty_approval_id');
        }
        expect(undoApprovalSpy2).toHaveBeenCalledTimes(0);
    });

    it('should trim approval ID before processing', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: true,
            details: {
                tokensRestored: 5,
                invocationDecremented: 1
            }
        });

        const effect = {
            approvalId: '  trimmed-id  '
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        const undoApprovalSpy3 = mockApprovalService.undoApproval;

        if (result && typeof result === 'object' && 'success' in result) {
            expect(result.success).toBe(true);
        }
        expect(undoApprovalSpy3).toHaveBeenCalledWith('trimmed-id');
    });

    it('should handle unknown error reason gracefully', async () => {
        mockApprovalService.undoApproval.mockReturnValue({
            success: false
        });

        const effect = {
            approvalId: 'unknown-error'
        };

        const event = {
            effect,
            trigger: {
                metadata: {
                    username: 'testuser'
                }
            }
        };

        const result = await undoEffect.onTriggerEvent(event as any);

        expect(result).toBeTruthy();
        if (result && typeof result === 'object' && 'success' in result && 'outputs' in result) {
            const outputs = result.outputs as any;
            expect(result.success).toBe(true);
            expect(outputs.rateLimitUndoSuccess).toBe('false');
            expect(outputs.rateLimitUndoReason).toBe('unknown');
        }
    });
});
