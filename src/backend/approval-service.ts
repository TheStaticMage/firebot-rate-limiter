import { logger } from '../main';
import { BucketService } from './bucket-service';
import { BucketData } from './bucket-data';

interface ApprovalEntry {
    approvalId: string;
    bucketId: string;
    bucketKey: string;
    tokensConsumed: number;
    invocationIncremented: number;
    timestamp: number;
}

interface UndoResponse {
    success: boolean;
    reason?: string;
    details?: {
        tokensRestored?: number;
        invocationDecremented?: number;
    };
}

export class ApprovalService {
    private approvals: Map<string, ApprovalEntry>;
    private cleanupIntervalId: NodeJS.Timeout | null;
    private readonly EXPIRATION_MS = 600000; // 10 minutes
    private readonly CLEANUP_INTERVAL_MS = 60000; // 60 seconds
    private bucketService: BucketService;
    private bucketData: BucketData;

    constructor(bucketService: BucketService, bucketData: BucketData) {
        this.approvals = new Map();
        this.bucketService = bucketService;
        this.bucketData = bucketData;
        this.cleanupIntervalId = setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL_MS);
    }

    recordApproval(approvalId: string, bucketId: string, bucketKey: string, tokensConsumed: number, invocationIncremented: number): void {
        const entry: ApprovalEntry = {
            approvalId,
            bucketId,
            bucketKey,
            tokensConsumed,
            invocationIncremented,
            timestamp: Date.now()
        };

        this.approvals.set(approvalId, entry);
        logger.debug(`Recorded approval: approvalId=${approvalId} bucketId=${bucketId} bucketKey=${bucketKey} tokensConsumed=${tokensConsumed} invocationIncremented=${invocationIncremented}`);
    }

    getApproval(approvalId: string): ApprovalEntry | null {
        const entry = this.approvals.get(approvalId);
        if (!entry) {
            return null;
        }

        const age = Date.now() - entry.timestamp;
        if (age >= this.EXPIRATION_MS) {
            logger.debug(`Approval expired: approvalId=${approvalId} age=${age}ms`);
            return null;
        }

        return entry;
    }

    removeApproval(approvalId: string): void {
        const removed = this.approvals.delete(approvalId);
        if (removed) {
            logger.debug(`Removed approval: approvalId=${approvalId}`);
        }
    }

    private cleanup(): void {
        const now = Date.now();
        let removedCount = 0;

        for (const [approvalId, entry] of this.approvals.entries()) {
            const age = now - entry.timestamp;
            if (age >= this.EXPIRATION_MS) {
                this.approvals.delete(approvalId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            logger.debug(`Cleanup removed ${removedCount} expired approvals`);
        }
    }

    undoApproval(approvalId: string): UndoResponse {
        logger.debug(`Undo attempt: approvalId=${approvalId}`);

        const approval = this.getApproval(approvalId);
        if (!approval) {
            logger.debug(`Undo failed: approvalId=${approvalId} reason=invalid_or_expired`);
            return { success: false, reason: 'invalid_or_expired' };
        }

        const bucket = this.bucketService.getBucket(approval.bucketId);
        if (!bucket) {
            logger.debug(`Undo failed: approvalId=${approvalId} reason=bucket_not_found bucketId=${approval.bucketId}`);
            return { success: false, reason: 'bucket_not_found' };
        }

        const bucketDataEntries = this.bucketData.getAllBucketData(approval.bucketId);
        const entry = bucketDataEntries[approval.bucketKey];
        if (!entry) {
            logger.debug(`Undo failed: approvalId=${approvalId} reason=key_not_found bucketId=${approval.bucketId} bucketKey=${approval.bucketKey}`);
            return { success: false, reason: 'key_not_found' };
        }

        const originalTokenCount = entry.tokenCount;

        const newTokenCount = Math.min(bucket.maxTokens, entry.tokenCount + approval.tokensConsumed);
        const newInvocationCount = Math.max(0, entry.invocationCount - approval.invocationIncremented);

        const tokensRestored = newTokenCount - originalTokenCount;
        const invocationDecremented = approval.invocationIncremented;

        this.bucketData.setKey(approval.bucketId, approval.bucketKey, {
            ...entry,
            tokenCount: newTokenCount,
            invocationCount: newInvocationCount,
            lastUpdated: Date.now()
        });

        this.removeApproval(approvalId);

        logger.debug(`Undo successful: approvalId=${approvalId} bucketId=${approval.bucketId} bucketKey=${approval.bucketKey} tokensRestored=${tokensRestored} invocationDecremented=${invocationDecremented}`);

        return {
            success: true,
            details: {
                tokensRestored,
                invocationDecremented
            }
        };
    }

    shutdown(): void {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = null;
        }
        this.approvals.clear();
        logger.debug('ApprovalService shutdown complete');
    }
}
