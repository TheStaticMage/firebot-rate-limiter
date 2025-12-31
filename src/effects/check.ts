import { Firebot } from '@crowbartools/firebot-custom-scripts-types';
import { EffectScope } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { randomUUID } from 'crypto';
import { bucketData } from '../backend/bucket-data';
import { emitEvent } from '../events';
import { approvalService, firebot, logger } from '../main';
import { CheckRateLimitRequest, CheckRateLimitResponse, LimitApprovedEventMetadata, LimitExceededEventMetadata, RejectReason } from '../shared/types';

type effectModel = {
    id: string; // Set by Firebot
    bucketId: string;
    bucketType: 'simple' | 'advanced';
    bucketSize: number | string;
    bucketRate: number | string;
    keyType: 'user' | 'global' | 'custom';
    key: string;
    tokens: number | string;
    inquiry: boolean;
    enforceStreamer: boolean;
    enforceBot: boolean;
    rejectReward: boolean;
    stopExecution: boolean;
    stopExecutionBubble: boolean;
    triggerEvent: boolean;
    triggerApproveEvent: boolean;
    rateLimitMetadata: string;
    invocationLimit: boolean;
    invocationLimitValue: number | string;
}

export const checkEffect: Firebot.EffectType<effectModel> = {
    definition: {
        id: "rate-limiter:check",
        name: "Rate Limiter: Check Request",
        description: "Determine if a request is allowed according to the rate limiter.",
        icon: "fad fa-check-circle",
        categories: ["advanced"],
        dependencies: [],
        outputs: [
            {
                label: "Allowed",
                description: "Whether the request is allowed according to the rate limiter. This will always be 'true' or 'false'.",
                defaultName: "rateLimitAllowed"
            },
            {
                label: "Invocation",
                description: "The number of times this effect has been successfully invoked (including this one). This will be a number.",
                defaultName: "rateLimitInvocation"
            },
            {
                label: "Next",
                description: "How long from now (in seconds) that the next request will be allowed if the same number of tokens are requested. This will be -1 if it is mathematically impossible for the request ever to be allowed.",
                defaultName: "rateLimitNext"
            },
            {
                label: "Remaining",
                description: "The number of remaining requests that can be made, subject to invocation limit. This will be -1 if there is no invocation limit.",
                defaultName: "rateLimitRemaining"
            },
            {
                label: "Error Message",
                description: "If the request was not allowed, this will contain the error message.",
                defaultName: "rateLimitErrorMessage"
            },
            {
                label: "Reject Reason",
                description: "If the request was not allowed, this will contain the reason the request was rejected. This will generally be either 'rate_limit' or 'invocation_limit'. (The rate limit is evaluated before the invocation limit.)",
                defaultName: "rateLimitRejectReason"
            },
            {
                label: "Raw Object",
                description: "The raw object with the rate limiter state for this request. **This is not guaranteed to be stable and may change in future versions.**",
                defaultName: "rateLimitRawObject"
            },
            {
                label: "Maximum Allowed Invocations",
                description: "The maximum number of times this effect can be successfully invoked. This will be a number, or -1 if the maximum allowed invocations is not defined.",
                defaultName: "rateLimitMaxAllowedInvocations"
            },
            {
                label: "Approval ID",
                description: "Unique identifier for this approval (can be used to undo the check)",
                defaultName: "rateLimitApprovalId"
            }
        ]
    },
    optionsTemplate: `
        <eos-container header="Bucket Type" pad-top="true">
            <firebot-select
                options="{ simple: 'Simple', advanced: 'Advanced' }"
                ng-init="bucketType = effect.bucketType || 'simple'"
                selected="bucketType"
                on-update="effect.bucketType = bucketType"
                aria-label="Bucket Type"
            />
        </eos-container>

        <eos-container header="Bucket" pad-top="true">
            <div class="form-group" ng-if="effect.bucketType === 'simple'">
                <div class="form-group">
                    <firebot-input input-title="Bucket Size" model="effect.bucketSize" data-type="number" required />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Refill Rate (tokens/sec)" model="effect.bucketRate" data-type="number" required />
                </div>
            </div>

            <div class="form-group" ng-if="effect.bucketType === 'advanced'">
                <firebot-searchable-select
                    ng-model="effect.bucketId"
                    placeholder="Select bucket"
                    items="bucketOptions"
                />
            </div>
        </eos-container>

        <eos-container header="Key" pad-top="true">
            <firebot-radios
                options="keyTypes"
                model="effect.keyType"
            />

            <div class="form-group" ng-if="effect.keyType === 'custom'">
                <firebot-input
                    model="effect.key"
                    input-title="Key"
                    placeholder-text="Enter custom key"
                />
            </div>
        </eos-container>

        <eos-container header="Tokens" pad-top="true">
            <div class="form-group">
                <firebot-input
                    model="effect.tokens"
                    input-title="Tokens required"
                    input-type="number"
                    placeholder-text="Enter number of tokens"
                />
            </div>

            <div class="form-group">
                <firebot-checkbox model="effect.inquiry" label="Inquiry only (do not count toward limits)" />
            </div>
        </eos-container>

        <eos-container header="Options" pad-top="true">
            <div class="form-group">
                <firebot-checkbox model="effect.enforceStreamer" label="Enforce limit for streamer" />
                <firebot-checkbox model="effect.enforceBot" label="Enforce limit for bot" />
                <firebot-checkbox model="effect.rejectReward" label="Reject channel point reward if limit exceeded" />
                <firebot-checkbox model="effect.stopExecution" label="Stop effect execution if limit exceeded" />
                <div style="margin-left: 10px" ng-if="effect.stopExecution">
                    <firebot-checkbox model="effect.stopExecutionBubble" label="Bubble the stop effect execution request to all parent effect lists" />
                </div>
                <firebot-checkbox model="effect.invocationLimit" label="Set a maximum number of times this can be successfully invoked" />
                <div class="form-group" ng-if="effect.invocationLimit">
                    <firebot-input
                        model="effect.invocationLimitValue"
                        input-title="Maximum Invocations"
                        input-type="number"
                        placeholder-text="Enter maximum invocations"
                    />
                </div>
                <div>
                    <firebot-checkbox model="effect.triggerApproveEvent" label="Trigger the 'Rate Limit Approved' event if approved" />
                </div>
                <div>
                    <firebot-checkbox model="effect.triggerEvent" label="Trigger the 'Rate Limit Exceeded' event if exceeded" />
                </div>
                <div class="form-group" ng-if="effect.triggerEvent">
                    <firebot-input
                        model="effect.rateLimitMetadata"
                        input-title="rateLimitMetadata"
                        placeholder-text="Optional value"
                    />
                </div>
            </div>
        </eos-container>
    `,
    getDefaultLabel: (effect: effectModel, backendCommunicator: any) => {
        if (!effect) {
            return "";
        }

        if (effect.bucketType === 'simple') {
            return `${effect.keyType.toLocaleUpperCase()} | ${effect.bucketSize} @ ${effect.bucketRate}/sec`;
        }

        const response = backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId: effect.bucketId });
        const bucket = response.bucket;
        if (!bucket) {
            return "!!Bucket not found!!";
        }

        return `${effect.keyType.toLocaleUpperCase()} | ${bucket.name}`;
    },
    optionsValidator: (effect: effectModel): string[] => {
        const errors: string[] = [];
        if (effect.bucketType === 'simple') {
            if (effect.bucketSize === undefined || effect.bucketSize === null || String(effect.bucketSize).trim() === "") {
                errors.push("Bucket Size is required");
            }
            if (effect.bucketRate === undefined || effect.bucketRate === null || String(effect.bucketRate).trim() === "") {
                errors.push("Refill Rate is required");
            }
        } else {
            if (!effect.bucketId) {
                errors.push("Bucket is required");
            }
        }
        if (!effect.keyType) {
            errors.push("Key Type is required");
        }
        if (effect.keyType === "custom" && !effect.key) {
            errors.push("Custom Key is required");
        }
        if (effect.tokens === undefined || effect.tokens === null || String(effect.tokens).trim() === "") {
            errors.push("Tokens must be specified");
        }
        if (effect.invocationLimit && (effect.invocationLimitValue === undefined || effect.invocationLimitValue === null || String(effect.invocationLimitValue).trim() === "")) {
            errors.push("Invocation Limit Value is required");
        }
        return errors;
    },
    optionsController: ($scope: EffectScope<effectModel>, backendCommunicator: any, ngToast: any) => {
        $scope.effect = $scope.effect || {};
        $scope.effect.enforceBot = $scope.effect.enforceBot === true;
        $scope.effect.enforceStreamer = $scope.effect.enforceStreamer === true;
        $scope.effect.key = $scope.effect.key || "";
        $scope.effect.keyType = $scope.effect.keyType || "user";
        $scope.effect.rejectReward = $scope.effect.rejectReward === true;
        $scope.effect.stopExecution = $scope.effect.stopExecution !== undefined ? $scope.effect.stopExecution : true;
        $scope.effect.stopExecutionBubble = $scope.effect.stopExecutionBubble === true;
        $scope.effect.inquiry = $scope.effect.inquiry === true;
        $scope.effect.tokens = $scope.effect.tokens !== undefined ? $scope.effect.tokens : 10;
        $scope.effect.triggerEvent = $scope.effect.triggerEvent === true;
        $scope.effect.triggerApproveEvent = $scope.effect.triggerApproveEvent === true;
        $scope.effect.rateLimitMetadata = $scope.effect.rateLimitMetadata || "";
        $scope.effect.invocationLimit = $scope.effect.invocationLimit === true;
        $scope.effect.invocationLimitValue = $scope.effect.invocationLimitValue || 0;
        $scope.effect.bucketType = $scope.effect.bucketType || "simple";
        $scope.effect.bucketSize = $scope.effect.bucketSize !== undefined ? $scope.effect.bucketSize : 10;
        $scope.effect.bucketRate = $scope.effect.bucketRate !== undefined ? $scope.effect.bucketRate : 1;

        $scope.bucketType = $scope.effect.bucketType;

        $scope.keyTypes = {
            "user": "User",
            "global": "Global",
            "custom": "Custom"
        };

        const buckets = backendCommunicator.fireEventSync("rate-limiter:getBucketsAsArray", {});
        if (buckets.errorMessage) {
            ngToast.create({
                className: 'danger',
                content: `Error loading buckets: ${buckets.errorMessage}`
            });
            return;
        }

        $scope.bucketOptions = buckets.buckets.map((bucket: any) => ({
            id: bucket.id,
            name: bucket.name
        }));

        // Check if the selected bucketId exists in the options
        if (
            $scope.effect.bucketType === 'advanced' &&
            $scope.effect.bucketId &&
            !buckets.buckets.some((option: any) => option.id === $scope.effect.bucketId)
        ) {
            ngToast.create({
                className: 'danger',
                content: `Selected bucket is not available. Please choose a valid bucket.`
            });
            $scope.effect.bucketId = '';
        }
    },
    onTriggerEvent: async (event) => {
        const { effect, trigger } = event;

        const invocationLimitValue = Number(effect.invocationLimitValue);
        const sanitizedInvocationLimitValue = Number.isFinite(invocationLimitValue) ? Math.max(0, invocationLimitValue) : 0;

        const result = {
            success: true,
            execution: {
                stop: false,
                bubbleStop: false
            },
            outputs: {
                rateLimitAllowed: "false", // These need to be strings
                rateLimitNext: -1,
                rateLimitRemaining: -1,
                rateLimitInvocation: 0, // This will be incremented later
                rateLimitErrorMessage: "",
                rateLimitRejectReason: "",
                rateLimitRawObject: {
                    request: {},
                    response: {}
                },
                rateLimitMaxAllowedInvocations: effect.invocationLimit ? sanitizedInvocationLimitValue : -1,
                rateLimitApprovalId: ""
            }
        };

        // Compute the key based on the key type
        let bucketKey = "";
        if (effect.keyType === 'global') {
            bucketKey = "global";
        } else if (effect.keyType === 'user') {
            bucketKey = `user:${trigger.metadata.username}`;
        } else {
            bucketKey = `custom:${effect.key}`;
        }

        // There's a check in getBucketData that handles the case where the
        // bucket doesn't exist so we don't have to check that here.
        const bucketSizeValue = Number(effect.bucketSize);
        const bucketRateValue = Number(effect.bucketRate);
        const request: CheckRateLimitRequest = {
            bucketType: effect.bucketType,
            bucketId: effect.bucketType === 'advanced' ? effect.bucketId : effect.id,
            bucketSize: bucketSizeValue,
            bucketRate: bucketRateValue,
            key: bucketKey,
            tokenRequest: Number(effect.tokens),
            inquiry: effect.inquiry === true,
            invocationLimit: effect.invocationLimit === true,
            invocationLimitValue: sanitizedInvocationLimitValue
        };

        const invalidBucketErrors: string[] = [];
        if (effect.bucketType === 'simple') {
            if (!Number.isFinite(bucketSizeValue) || bucketSizeValue <= 0) {
                invalidBucketErrors.push("Bucket Size must be greater than 0");
            }
            if (!Number.isFinite(bucketRateValue) || bucketRateValue < 0) {
                invalidBucketErrors.push("Refill Rate must be greater than or equal to 0");
            }
        }

        let alwaysAllow = false;
        let checkResult: CheckRateLimitResponse;

        if (invalidBucketErrors.length > 0) {
            checkResult = {
                success: false,
                next: -1,
                remaining: -1,
                invocation: 0,
                rejectReason: RejectReason.Error,
                errorMessage: invalidBucketErrors.join(" ")
            };
        } else {
            // Don't bother checking rate limits for the streamer
            if (!effect.enforceStreamer && trigger.metadata.username === firebot.firebot.accounts.streamer.username) {
                logger.debug(`Rate limit IGNORE (streamer): bucketId=${request.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry}`);
                result.outputs.rateLimitAllowed = "true";
                request.inquiry = true;
                alwaysAllow = true;
            }

            // Don't bother checking rate limits for the bot
            if (!effect.enforceBot && trigger.metadata.username === firebot.firebot.accounts.bot.username) {
                logger.debug(`Rate limit IGNORE (bot): bucketId=${request.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry}`);
                result.outputs.rateLimitAllowed = "true";
                request.inquiry = true;
                alwaysAllow = true;
            }

            // Set outputs based on the result of the check
            checkResult = bucketData.check(request);
        }
        result.outputs.rateLimitRawObject.request = request;
        result.outputs.rateLimitRawObject.response = checkResult;
        result.outputs.rateLimitAllowed = checkResult.success ? 'true' : 'false';
        result.outputs.rateLimitNext = checkResult.next;
        result.outputs.rateLimitRemaining = checkResult.remaining;
        result.outputs.rateLimitInvocation = checkResult.invocation;
        result.outputs.rateLimitErrorMessage = checkResult.errorMessage || "";
        result.outputs.rateLimitRejectReason = checkResult.rejectReason || "";

        // Success case
        if (alwaysAllow || checkResult.success) {
            logger.debug(`Rate limit PASS: alwaysAllow=${alwaysAllow} success=${checkResult.success} bucketId=${request.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry} next=${checkResult.next} remaining=${checkResult.remaining} invocation=${checkResult.invocation}`);
            result.outputs.rateLimitAllowed = "true";

            const approvalId = randomUUID();
            result.outputs.rateLimitApprovalId = approvalId;
            logger.debug(`Generated approval ID: approvalId=${approvalId} bucketId=${request.bucketId} bucketKey=${bucketKey}`);

            const tokensConsumed = request.inquiry ? 0 : request.tokenRequest;
            const invocationIncremented = (checkResult.success && !request.inquiry) ? 1 : 0;
            approvalService.recordApproval(approvalId, request.bucketId, bucketKey, tokensConsumed, invocationIncremented);

            if (effect.triggerApproveEvent) {
                logger.debug(`Emitting 'approved' event: bucketId=${request.bucketId} username=${trigger.metadata.username}`);
                const approvedMetadata: LimitApprovedEventMetadata = {
                    alwaysAllow: alwaysAllow,
                    success: checkResult.success,
                    bucketId: request.bucketId,
                    bucketKey: bucketKey,
                    username: trigger.metadata.username,
                    messageId: (trigger.metadata.chatMessage as any)?.id || "",
                    triggerMetadata: trigger.metadata || {},
                    triggerType: trigger.type || "",
                    triggerUsername: typeof trigger.metadata.eventData?.originalUsername === "string"
                        ? trigger.metadata.eventData.originalUsername
                        : (typeof trigger.metadata.eventData?.username === "string"
                            ? trigger.metadata.eventData.username
                            : trigger.metadata.username),
                    approvalId: approvalId
                };
                emitEvent("approved", approvedMetadata, false);
            }

            return result;
        }
        logger.debug(`Rate limit FAIL: bucketId=${request.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry} next=${checkResult.next} remaining=${checkResult.remaining} invocation=${checkResult.invocation} errorMessage=${checkResult.errorMessage} reason=${checkResult.rejectReason}`);

        // We may stop execution
        result.execution.stop = effect.stopExecution;
        result.execution.bubbleStop = effect.stopExecutionBubble;

        // "Rate Limit Exceeded" event
        if (effect.triggerEvent) {
            // Check stack depth to prevent infinite loops
            const stackDepth = typeof trigger.metadata.eventData?.stackDepth === "number" ? trigger.metadata.eventData.stackDepth : 0;
            if (stackDepth >= 10) {
                logger.warn(`Stack depth exceeded for rate limit event: bucketId=${request.bucketId} key=${bucketKey} stackDepth=${stackDepth}`);
                return result;
            }

            // Emit the event
            logger.debug(`Emitting 'limit-exceeded' event: bucketId=${request.bucketId} username=${trigger.metadata.username} errorMessage=${checkResult.errorMessage}`);
            const eventMetadata: LimitExceededEventMetadata = {
                bucketId: request.bucketId,
                errorMessage: checkResult.errorMessage,
                inquiry: effect.inquiry,
                invocation: checkResult.invocation,
                invocationLimit: effect.invocationLimit,
                invocationLimitValue: sanitizedInvocationLimitValue,
                bucketKey: bucketKey,
                messageId: (trigger.metadata.chatMessage as any)?.id || "",
                metadataKey: effect.rateLimitMetadata || "",
                next: checkResult.next,
                triggerMetadata: trigger.metadata || {},
                triggerType: trigger.type || "",
                triggerUsername: typeof trigger.metadata.eventData?.originalUsername === "string"
                    ? trigger.metadata.eventData.originalUsername
                    : (typeof trigger.metadata.eventData?.username === "string"
                        ? trigger.metadata.eventData.username
                        : trigger.metadata.username),
                rejectReason: checkResult.rejectReason,
                remaining: checkResult.remaining,
                stackDepth: stackDepth + 1,
                tokens: request.tokenRequest,
                username: trigger.metadata.username
            };
            emitEvent("limit-exceeded", eventMetadata, false);
        }

        // We may reject a channel point reward
        if (effect.rejectReward) {
            const redemptionId = trigger.metadata.eventData?.redemptionId || trigger.metadata.redemptionId;
            const rewardId = trigger.metadata.eventData?.rewardId || trigger.metadata.rewardId;

            if (typeof redemptionId === "string" && redemptionId.length > 0 && typeof rewardId === "string" && rewardId.length > 0) {
                const rejectionRequest: RewardRedemptionsApprovalRequest = {
                    rewardId: rewardId,
                    redemptionIds: [redemptionId],
                    approve: false
                };
                const { twitchApi } = firebot.modules;
                try {
                    const response = await twitchApi.channelRewards.approveOrRejectChannelRewardRedemption(rejectionRequest);
                    if (!response) {
                        throw new Error("Call to approveOrRejectChannelRewardRedemption returned false");
                    }
                    logger.debug(`Rejecting channel point reward: bucketId=${request.bucketId} key=${bucketKey} redemptionId=${redemptionId} rewardId=${rewardId}`);
                } catch (err) {
                    logger.error(`Error rejecting channel point reward: bucketId=${request.bucketId} key=${bucketKey} redemptionId=${redemptionId} rewardId=${rewardId} error=${err}`);
                }
            } else {
                logger.warn(`Not rejecting channel point reward because this does not appear to be a channel point reward redemption: bucketId=${request.bucketId} key=${bucketKey}`);
            }
        }

        // Done
        return result;
    }
};

interface RewardRedemptionsApprovalRequest {
    rewardId: string;
    redemptionIds?: string[];
    approve?: boolean;
}
