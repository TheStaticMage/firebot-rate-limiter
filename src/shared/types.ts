export type Bucket = {
    name: string;
    type: 'simple' | 'advanced';
    startTokens: number;
    maxTokens: number;
    refillRate: number;
    lifetimeMaxTokens: boolean;
    lifetimeMaxTokensValue: number;
    persistBucket: boolean;
    fillFromStart: boolean;
    fillBucketAcrossRestarts: boolean;
}

export type BucketWithId = Bucket & {
    id: string;
}

export type BucketDataEntry = {
    tokenCount: number;
    lastUpdated: number;
    lifetimeTokenCount: number;
    invocationCount: number;
};

export type CheckRateLimitResponse = {
    success: boolean;
    next: number; // Seconds until next available token or 0 if available
    remaining: number; // Remaining invocations allowed after the request
    invocation: number; // Number of invocations made in this check
    rejectReason?: RejectReason; // Reason for rejection if not successful
    errorMessage?: string; // Optional error message
}

export type CheckRateLimitRequest = {
    bucketType: 'simple' | 'advanced';
    bucketId: string;
    bucketSize: number; // Only used for simple buckets
    bucketRate: number; // Only used for simple buckets
    key: string;
    tokenRequest: number;
    inquiry: boolean;
    invocationLimit: boolean;
    invocationLimitValue: number;
}

export type InstantiateBucketParameters = {
    bucketSize: number;
    bucketRate: number;
}

export type DeleteBucketResponse = {
    buckets: Record<string, Bucket>;
    errorMessage?: string; // Optional error message
}

export type GetBucketResponse = {
    bucket: BucketWithId | null;
    errorMessage?: string; // Optional error message
}

export type GetBucketsResponse = {
    buckets: Record<string, Bucket>;
    errorMessage?: string; // Optional error message
}

export type GetBucketsAsArrayResponse = {
    buckets: BucketWithId[];
    errorMessage?: string; // Optional error message
}

export type LimitApprovedEventMetadata = {
    alwaysAllow: boolean; // Whether this approval was based on an "always" condition
    success: boolean; // Whether the success was actually true, not considering "always" condition
    bucketId: string;
    bucketKey: string;
    username: string;
    messageId: string; // ID of the chat message that triggered the check
    triggerMetadata: Record<string, any>; // Original event data that triggered the check
    triggerType: string; // Type of the original event source
    triggerUsername: string; // Username from the original event source if tracked
}

export type LimitExceededEventMetadata = {
    bucketId: string;
    bucketKey: string;
    errorMessage?: string; // Optional error message
    inquiry: boolean; // Whether the check was an inquiry
    invocation: number; // Number of invocations made in this check
    invocationLimit: boolean; // Whether the check has an invocation limit
    invocationLimitValue: number; // Invocation limit value if applicable
    messageId: string; // ID of the chat message that triggered the check
    metadataKey: string; // Key used to store metadata in the event
    next: number; // Seconds until next available token
    triggerMetadata: Record<string, any>; // Original event data that triggered the check
    triggerType: string; // Type of the original event source
    triggerUsername: string; // Username from the original event source if tracked
    rejectReason?: RejectReason; // Reason for rejection if not successful
    remaining: number; // Remaining invocations allowed after the request
    stackDepth: number; // Prevents infinite loops in event triggering
    tokens: number; // Number of tokens requested
    username: string;
};

export type SaveBucketResponse = {
    buckets: Record<string, Bucket>;
    errorMessage?: string; // Optional error message
}

export interface ScriptSettings {
    advancedBuckets: boolean;
}

export enum RejectReason {
    Error = 'error',
    RateLimit = 'rate_limit',
    InvocationLimit = 'invocation_limit',
}
