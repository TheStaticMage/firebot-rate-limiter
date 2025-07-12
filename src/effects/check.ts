import { Firebot } from '@crowbartools/firebot-custom-scripts-types';
import { EffectScope } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { bucketData } from '../backend/bucket-data';
import { firebot, logger } from '../main';
import { CheckRateLimitRequest, LimitExceededEventMetadata } from '../shared/types';
import { emitEvent } from '../events';

type effectModel = {
    bucketId: string;
    keyType: 'user' | 'global' | 'custom';
    key: string;
    tokens: number;
    inquiry: boolean;
    enforceStreamer: boolean;
    enforceBot: boolean;
    stopExecution: boolean;
    stopExecutionBubble: boolean;
    triggerEvent: boolean;
    rateLimitMetadata: string;
    invocationLimit: boolean;
    invocationLimitValue: number;
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
            }
        ]
    },
    optionsTemplate: `
        <eos-container header="Bucket" pad-top="true">
            <firebot-searchable-select
                ng-model="effect.bucketId"
                placeholder="Select bucket"
                items="bucketOptions"
            />
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
                        tooltip="The maximum number of times this can successfully pass before being rate limited."
                    />
                </div>
                <firebot-checkbox model="effect.triggerEvent" label="Trigger the 'Rate Limit Exceeded' event if exceeded" />
                <div class="form-group" ng-if="effect.triggerEvent">
                    <firebot-input
                        model="effect.rateLimitMetadata"
                        input-title="rateLimitMetadata"
                        tooltip="The event metadata will include a field 'rateLimitMetadata' with this value."
                        placeholder-text="Optional value"
                    />
                </div>
            </div>
        </eos-container>
    `,
    getDefaultLabel: (effect: effectModel, backendCommunicator: any) => {
        if (!effect || !effect.bucketId) {
            return "";
        }

        const response = backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId: effect.bucketId });
        const bucket = response.bucket;
        if (!bucket) {
            return "!!Bucket not found!!";
        }

        return `${bucket.name}: ${effect.keyType}`;
    },
    optionsValidator: (effect: effectModel): string[] => {
        const errors: string[] = [];
        if (!effect.bucketId) {
            errors.push("Bucket is required");
        }
        if (!effect.keyType) {
            errors.push("Key Type is required");
        }
        if (effect.keyType === "custom" && !effect.key) {
            errors.push("Custom Key is required");
        }
        if (!effect.tokens) {
            errors.push("Tokens are required");
        }
        if (effect.tokens <= 0) {
            errors.push("Tokens must be greater than 0");
        }
        return errors;
    },
    optionsController: ($scope: EffectScope<effectModel>, backendCommunicator: any, ngToast: any) => {
        $scope.effect = $scope.effect || {};
        $scope.effect.enforceBot = $scope.effect.enforceBot === true;
        $scope.effect.enforceStreamer = $scope.effect.enforceStreamer === true;
        $scope.effect.key = $scope.effect.key || "";
        $scope.effect.keyType = $scope.effect.keyType || "user";
        $scope.effect.stopExecution = $scope.effect.stopExecution !== undefined ? $scope.effect.stopExecution : true;
        $scope.effect.stopExecutionBubble = $scope.effect.stopExecutionBubble === true;
        $scope.effect.inquiry = $scope.effect.inquiry === true;
        $scope.effect.tokens = $scope.effect.tokens !== undefined ? $scope.effect.tokens : 10;
        $scope.effect.triggerEvent = $scope.effect.triggerEvent === true;
        $scope.effect.rateLimitMetadata = $scope.effect.rateLimitMetadata || "";
        $scope.effect.invocationLimit = $scope.effect.invocationLimit === true;
        $scope.effect.invocationLimitValue = $scope.effect.invocationLimitValue || 0;

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
        logger.debug(`Checking rate limit for bucketId=${effect.bucketId}`);

        const result = {
            success: true,
            execution: {
                stop: false,
                bubbleStop: false
            },
            outputs: {
                rateLimitAllowed: "false",
                rateLimitNext: -1,
                rateLimitRemaining: -1,
                rateLimitInvocation: 0, // This will be incremented later
                rateLimitErrorMessage: "",
                rateLimitRejectReason: "",
                rateLimitRawObject: {
                    request: {},
                    response: {}
                }
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

        // Streamer and bot checks might always pass, but we always check the rate limit to update statistics
        let alwaysAllow = false;

        // Don't bother checking rate limits for the streamer
        if (!effect.enforceStreamer && trigger.metadata.username === firebot.firebot.accounts.streamer.username) {
            logger.debug(`Rate limit IGNORE (streamer): bucketId=${effect.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry}`);
            result.outputs.rateLimitAllowed = "true";
            alwaysAllow = true;
        }

        // Don't bother checking rate limits for the bot
        if (!effect.enforceBot && trigger.metadata.username === firebot.firebot.accounts.bot.username) {
            logger.debug(`Rate limit IGNORE (bot): bucketId=${effect.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry}`);
            result.outputs.rateLimitAllowed = "true";
            alwaysAllow = true;
        }

        // There's a check in getBucketData that handles the case where the
        // bucket doesn't exist so we don't have to check that here.
        const request: CheckRateLimitRequest = {
            bucketId: effect.bucketId,
            key: bucketKey,
            tokenRequest: effect.tokens,
            inquiry: alwaysAllow || effect.inquiry,
            invocationLimit: effect.invocationLimit,
            invocationLimitValue: effect.invocationLimitValue
        };

        // Set outputs based on the result of the check
        const checkResult = bucketData.check(request);
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
            logger.debug(`Rate limit PASS: alwaysAllow=${alwaysAllow} success=${checkResult.success} bucketId=${effect.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry} next=${checkResult.next} remaining=${checkResult.remaining} invocation=${checkResult.invocation}`);
            result.outputs.rateLimitAllowed = "true";
            return result;
        }
        logger.debug(`Rate limit FAIL: bucketId=${effect.bucketId} key=${bucketKey} tokens=${effect.tokens} inquiry=${effect.inquiry} next=${checkResult.next} remaining=${checkResult.remaining} invocation=${checkResult.invocation} errorMessage=${checkResult.errorMessage} reason=${checkResult.rejectReason}`);

        // We may stop execution
        result.execution.stop = effect.stopExecution;
        result.execution.bubbleStop = effect.stopExecutionBubble;

        // "Rate Limit Exceeded" event
        if (effect.triggerEvent) {
            // Check stack depth to prevent infinite loops
            const stackDepth = typeof trigger.metadata.eventData?.stackDepth === "number" ? trigger.metadata.eventData.stackDepth : 0;
            if (stackDepth >= 10) {
                logger.warn(`Stack depth exceeded for rate limit event: bucketId=${effect.bucketId} key=${bucketKey} stackDepth=${stackDepth}`);
                return result;
            }

            // Emit the event
            const eventMetadata: LimitExceededEventMetadata = {
                bucketId: effect.bucketId,
                errorMessage: checkResult.errorMessage,
                inquiry: effect.inquiry,
                invocation: checkResult.invocation,
                invocationLimit: effect.invocationLimit,
                invocationLimitValue: effect.invocationLimitValue,
                bucketKey: bucketKey,
                messageId: trigger.metadata.chatMessage?.id || "",
                metadataKey: effect.rateLimitMetadata || "",
                next: checkResult.next,
                originalEventId: trigger.metadata.event?.id || "",
                originalEventSourceId: trigger.metadata.eventSource?.id || "",
                originalUsername: typeof trigger.metadata.eventData?.originalUsername === "string"
                    ? trigger.metadata.eventData.originalUsername
                    : (typeof trigger.metadata.eventData?.username === "string"
                        ? trigger.metadata.eventData.username
                        : trigger.metadata.username),
                rejectReason: checkResult.rejectReason,
                remaining: checkResult.remaining,
                stackDepth: stackDepth + 1,
                tokens: effect.tokens,
                username: trigger.metadata.username
            };
            emitEvent("limit-exceeded", eventMetadata, false);
        }

        // Done
        return result;
    }
};
