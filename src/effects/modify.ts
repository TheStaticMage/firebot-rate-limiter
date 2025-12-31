import { Firebot } from '@crowbartools/firebot-custom-scripts-types';
import { EffectScope } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { BucketData, bucketData } from '../backend/bucket-data';
import { BucketService, bucketService } from '../backend/bucket-service';
import { logger } from '../main';

export type modifyEffectModel = {
    id: string; // Set by Firebot
    bucketId: string;
    keyType: 'user' | 'allusers' | 'global' | 'custom' | 'allkeys';
    userKey: string;
    customKey: string;
    action: 'modify' | 'delete';
    createMissing: boolean;
    currentTokenOperation: 'noChange' | 'add' | 'set';
    currentTokenValue: number;
    lifetimeTokenOperation: 'noChange' | 'add' | 'set';
    lifetimeTokenValue: number;
    invocationOperation: 'noChange' | 'add' | 'set';
    invocationValue: number;
    lastUpdatedOperation: 'noChange' | 'add' | 'set';
    lastUpdatedValue: number;
}

type processTriggerOutputs = {
    rateLimitModifyBucketDataSuccess: string; // "true" or "false"
    rateLimitModifyBucketDataRawObject: Record<string, any>; // The raw object of the bucket state after being modified
}

export class CriticalError extends Error {}
export class NonCriticalError extends Error {}

export const modifyBucketDataEffect: Firebot.EffectType<modifyEffectModel> = {
    definition: {
        id: "rate-limiter:modifyBucketData",
        name: "Rate Limiter: Modify Bucket Data",
        description: "Modify the data in a rate limiter bucket.",
        icon: "fal fa-fill",
        categories: ["advanced"],
        dependencies: [],
        outputs: [
            {
                label: "Success",
                description: "Whether the modification request matched at least one existing key in the bucket.",
                defaultName: "rateLimitModifyBucketDataSuccess"
            },
            {
                label: "Raw Object",
                description: "The raw object of the bucket state after being modified by this effect. **This is not guaranteed to be stable and may change in future versions.**",
                defaultName: "rateLimitModifyBucketDataRawObject"
            }
        ]
    },
    optionsTemplate: `
        <style>
            .bucket-modify-row {
                display: flex;
                align-items: center;
                width: 100%;
                gap: 8px;
            }
            .bucket-modify-label,
            .bucket-modify-select,
            .bucket-modify-input {
                box-sizing: border-box;
            }
            /* Set the widths to the minimum needed to fit the largest element, but keep them aligned */
            .bucket-modify-label {
                flex: 0 0 120px;
                max-width: 120px;
                min-width: 120px;
            }
            .bucket-modify-select {
                flex: 0 0 100px;
                max-width: 100px;
                min-width: 100px;
            }
            .bucket-modify-input {
                flex: 1 1 0;
                min-width: 0;
            }
        </style>
        <eos-container header="Bucket" pad-top="true">
            <div class="form-group">
                <firebot-searchable-select
                    ng-model="effect.bucketId"
                    placeholder="Select bucket"
                    items="bucketOptions"
                />
            </div>
        </eos-container>

        <eos-container header="Key" pad-top="true">
            <firebot-radio-container>
                <firebot-radio label="Global" model="effect.keyType" value="'global'" tooltip="This will modify the global entry in the bucket -- note that this does not modify any user keys" />
                <firebot-radio label="All Users" model="effect.keyType" value="'allusers'" />
                <firebot-radio label="One User" model="effect.keyType" value="'user'" />
                <div class="form-group flex-row jspacebetween" ng-if="effect.keyType === 'user'">
                    <firebot-input
                        model="effect.userKey"
                        input-title="Username"
                        placeholder-text="Enter username"
                    />
                </div>
                <firebot-radio label="Custom Key" model="effect.keyType" value="'custom'" />
                <div class="form-group flex-row jspacebetween" ng-if="effect.keyType === 'custom'">
                    <firebot-input
                        model="effect.customKey"
                        input-title="Custom Key"
                        placeholder-text="Enter custom key"
                    />
                </div>
                <firebot-radio label="All Keys" model="effect.keyType" value="'allkeys'" />
            </firebot-radio-container>
        </eos-container>

        <eos-container header="Modifications" pad-top="true">
            <firebot-radio-container>
                <firebot-radio label="Delete" model="effect.action" value="'delete'" />
                <firebot-radio label="Modify" model="effect.action" value="'modify'" />
                <div style="margin-left: 30px;" ng-if="effect.action == 'modify'">
                    <div class="bucket-modify-row form-group">
                        <span class="bucket-modify-label">Current Tokens</span>
                        <span class="bucket-modify-select">
                            <firebot-select
                                options="{ noChange: 'No Change', add: 'Add', set: 'Set' }"
                                ng-init="currentTokenOperation = effect.currentTokenOperation"
                                selected="currentTokenOperation"
                                on-update="effect.currentTokenOperation = currentTokenOperation"
                                right-justify="true"
                                aria-label="Choose Operation"
                            />
                        </span>
                        <span class="bucket-modify-input" ng-if="effect.currentTokenOperation == 'add' || effect.currentTokenOperation == 'set'">
                            <firebot-input
                                model="effect.currentTokenValue"
                                input-title="Tokens"
                                placeholder-text="Enter number of tokens"
                                type="number"
                            />
                        </span>
                    </div>
                    <div class="bucket-modify-row form-group">
                        <span class="bucket-modify-label">Lifetime Tokens</span>
                        <span class="bucket-modify-select">
                            <firebot-select
                                options="{ noChange: 'No Change', add: 'Add', set: 'Set' }"
                                ng-init="lifetimeTokenOperation = effect.lifetimeTokenOperation"
                                selected="lifetimeTokenOperation"
                                on-update="effect.lifetimeTokenOperation = lifetimeTokenOperation"
                                right-justify="true"
                                aria-label="Choose Operation"
                            />
                        </span>
                        <span class="bucket-modify-input" ng-if="effect.lifetimeTokenOperation == 'add' || effect.lifetimeTokenOperation == 'set'">
                            <firebot-input
                                model="effect.lifetimeTokenValue"
                                input-title="Tokens"
                                placeholder-text="Enter number of tokens"
                                type="number"
                            />
                        </span>
                    </div>
                    <div class="bucket-modify-row form-group">
                        <span class="bucket-modify-label">Invocations</span>
                        <span class="bucket-modify-select">
                            <firebot-select
                                options="{ noChange: 'No Change', add: 'Add', set: 'Set' }"
                                ng-init="invocationOperation = effect.invocationOperation"
                                selected="invocationOperation"
                                on-update="effect.invocationOperation = invocationOperation"
                                right-justify="true"
                                aria-label="Choose Operation"
                            />
                        </span>
                        <span class="bucket-modify-input" ng-if="effect.invocationOperation == 'add' || effect.invocationOperation == 'set'">
                            <firebot-input
                                model="effect.invocationValue"
                                input-title="Tokens"
                                placeholder-text="Enter number of tokens"
                                type="number"
                            />
                        </span>
                    </div>
                    <div class="bucket-modify-row form-group">
                        <span class="bucket-modify-label">Last Updated</span>
                        <span class="bucket-modify-select">
                            <firebot-select
                                options="{ noChange: 'No Change', add: 'Add', set: 'Set' }"
                                ng-init="lastUpdatedOperation = effect.lastUpdatedOperation"
                                selected="lastUpdatedOperation"
                                on-update="effect.lastUpdatedOperation = lastUpdatedOperation"
                                right-justify="true"
                                aria-label="Choose Operation"
                            />
                        </span>
                        <span class="bucket-modify-input" ng-if="effect.lastUpdatedOperation == 'add' || effect.lastUpdatedOperation == 'set'">
                            <firebot-input
                                model="effect.lastUpdatedValue"
                                input-title="Tokens"
                                placeholder-text="Enter number of tokens"
                                type="number"
                            />
                        </span>
                    </div>
                    <div class="form-group flex-row jspacebetween" ng-if="effect.keyType !== 'allkeys' && effect.keyType !== 'allusers'">
                        <firebot-checkbox
                            model="effect.createMissing"
                            label="Create Missing Key"
                            tooltip="If the key does not exist, create it with the specified values."
                        />
                    </div>
                </div>
            </firebot-radio-container>
        </eos-container>
    `,
    getDefaultLabel: (effect: modifyEffectModel, backendCommunicator: any) => {
        if (!effect) {
            return "";
        }

        const response = backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId: effect.bucketId });
        const bucket = response.bucket;
        if (!bucket) {
            return "!!Bucket not found!!";
        }

        return `${effect.keyType.toLocaleUpperCase()} | ${bucket.name}`;
    },
    optionsValidator: (effect: modifyEffectModel): string[] => {
        const errors: string[] = [];
        if (!effect.bucketId) {
            errors.push("Bucket is required");
        }
        if (!effect.keyType) {
            errors.push("Key Type is required");
        }
        if (effect.keyType === "custom" && !effect.customKey) {
            errors.push("Custom Key is required");
        }
        if (effect.keyType === "user" && !effect.userKey) {
            errors.push("Username is required for User key type");
        }
        return errors;
    },
    optionsController: ($scope: EffectScope<modifyEffectModel>, backendCommunicator: any, ngToast: any) => {
        $scope.effect = $scope.effect || {};
        $scope.effect.customKey = $scope.effect.customKey || "";
        $scope.effect.userKey = $scope.effect.userKey || "";
        $scope.effect.keyType = $scope.effect.keyType || "allusers";
        $scope.effect.action = $scope.effect.action || "modify";
        $scope.effect.createMissing = $scope.effect.createMissing || false;
        $scope.effect.currentTokenOperation = $scope.effect.currentTokenOperation || "noChange";
        $scope.effect.currentTokenValue = $scope.effect.currentTokenValue || 0;
        $scope.effect.lifetimeTokenOperation = $scope.effect.lifetimeTokenOperation || "noChange";
        $scope.effect.lifetimeTokenValue = $scope.effect.lifetimeTokenValue || 0;
        $scope.effect.invocationOperation = $scope.effect.invocationOperation || "noChange";
        $scope.effect.invocationValue = $scope.effect.invocationValue || 0;
        $scope.effect.lastUpdatedOperation = $scope.effect.lastUpdatedOperation || "noChange";
        $scope.effect.lastUpdatedValue = $scope.effect.lastUpdatedValue || 0;

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
        const { effect } = event;

        try {
            const result = processTrigger(effect, bucketData, bucketService);
            return {
                success: true,
                outputs: result
            };
        } catch (error) {
            if (error instanceof CriticalError) {
                logger.error(`Critical error processing modify bucket data effect: ${error.message}`);
                return {
                    success: false,
                    error: error.message
                };
            }
            logger.debug(`Non-critical error processing modify bucket data effect: ${error}`);
            return {
                success: true,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
};

export function processTrigger(effect: modifyEffectModel, bucketData: BucketData, bucketService: BucketService): processTriggerOutputs {
    const result: processTriggerOutputs = {
        rateLimitModifyBucketDataSuccess: "false", // These need to be strings
        rateLimitModifyBucketDataRawObject: bucketData.getAllBucketData(effect.bucketId)
    };

    // Get a list of keys to modify based on the effect's key type and any
    // other specified options.
    const selectedKeys = [];
    let selectedKey = "";
    if (effect.keyType === 'allusers') {
        const bucketKeys = bucketData.listKeys(effect.bucketId);
        for (const key of bucketKeys) {
            if (key.startsWith('user:')) {
                selectedKeys.push(key);
            }
        }
        if (selectedKeys.length === 0) {
            throw new NonCriticalError(`No user keys to ${effect.action} found in bucket ${effect.bucketId}.`);
        }
    } else if (effect.keyType === 'allkeys') {
        selectedKeys.push(...bucketData.listKeys(effect.bucketId));
        if (selectedKeys.length === 0) {
            throw new NonCriticalError(`No keys to ${effect.action} found in bucket ${effect.bucketId}.`);
        }
    } else if (effect.keyType === 'user') {
        if (!effect.userKey) {
            throw new NonCriticalError(`User key is required for 'user' key type (effect ID: ${effect.id}).`);
        }
        selectedKey = `user:${effect.userKey}`;
    } else if (effect.keyType === 'custom') {
        if (!effect.customKey) {
            throw new NonCriticalError(`Custom key is required for 'custom' key type (effect ID: ${effect.id}).`);
        }
        selectedKey = `custom:${effect.customKey}`;
    } else if (effect.keyType === 'global') {
        selectedKey = 'global';
    }

    // If we are checking a specific key, ensure it exists in the bucket.
    // Return early if it does not exist and createMissing is false.
    if (selectedKey) {
        if (!effect.createMissing && !bucketData.hasKey(effect.bucketId, selectedKey)) {
            throw new NonCriticalError(`No keys found to ${effect.action} in bucket ${effect.bucketId} with key ${selectedKey}.`);
        }
        selectedKeys.push(selectedKey);
    }

    // If the action is to delete, then delete the keys and return.
    if (effect.action === 'delete') {
        let deletedCount = 0;
        for (const key of selectedKeys) {
            if (bucketData.deleteKey(effect.bucketId, key)) {
                deletedCount++;
            }
        }
        result.rateLimitModifyBucketDataSuccess = deletedCount > 0 ? "true" : "false";
        result.rateLimitModifyBucketDataRawObject = bucketData.getAllBucketData(effect.bucketId);
        return result;
    }

    // At this point, the action is to modify the keys, and we know that
    // each key exists (or will be created). Process each key and apply the
    // modifications specified in the effect.
    const bucket = bucketService.getBucket(effect.bucketId);
    if (!bucket) {
        throw new CriticalError(`Bucket not found for modification (effect ID: ${effect.id}, bucketId: ${effect.bucketId}).`);
    }

    for (const key of selectedKeys) {
        // Add any tokens to the bucket data based on the time and refill
        // rate.
        const bucketDataEntry = bucketData.addTokens(effect.bucketId, bucket, key);
        const changes: string[] = [];

        // Apply the modifications based on the effect's options.
        if (effect.currentTokenOperation === 'add') {
            const amount = Number(effect.currentTokenValue);
            changes.push(`Adding ${amount} tokens (new value: ${bucketDataEntry.tokenCount + amount})`);
            bucketDataEntry.tokenCount += amount;
        } else if (effect.currentTokenOperation === 'set') {
            bucketDataEntry.tokenCount = Number(effect.currentTokenValue);
            changes.push(`Setting tokens to ${effect.currentTokenValue}`);
        }

        if (effect.lifetimeTokenOperation === 'add') {
            const amount = Number(effect.lifetimeTokenValue);
            changes.push(`Adding ${amount} lifetime tokens (new value: ${bucketDataEntry.lifetimeTokenCount + amount})`);
            bucketDataEntry.lifetimeTokenCount += amount;
        } else if (effect.lifetimeTokenOperation === 'set') {
            bucketDataEntry.lifetimeTokenCount = Number(effect.lifetimeTokenValue);
            changes.push(`Setting lifetime tokens to ${bucketDataEntry.lifetimeTokenCount}`);
        }

        if (effect.invocationOperation === 'add') {
            const amount = Number(effect.invocationValue);
            changes.push(`Adding ${amount} invocations (new value: ${bucketDataEntry.invocationCount + amount})`);
            bucketDataEntry.invocationCount += amount;
        } else if (effect.invocationOperation === 'set') {
            bucketDataEntry.invocationCount = Number(effect.invocationValue);
            changes.push(`Setting invocations to ${bucketDataEntry.invocationCount}`);
        }

        if (effect.lastUpdatedOperation === 'add') {
            const amount = 1000 * Number(effect.lastUpdatedValue);
            changes.push(`Adding ${amount} milliseconds to last updated (new value: ${bucketDataEntry.lastUpdated + amount})`);
            bucketDataEntry.lastUpdated += amount;
        } else if (effect.lastUpdatedOperation === 'set') {
            bucketDataEntry.lastUpdated = 1000 * Number(effect.lastUpdatedValue);
            changes.push(`Setting last updated to ${bucketDataEntry.lastUpdated}`);
        }

        // Update the bucket data with the modified entry.
        logger.debug(`Modifying bucket data for key: ${key} in bucket: ${effect.bucketId}: ${JSON.stringify(changes)}`);
        bucketData.setKey(effect.bucketId, key, bucketDataEntry);
        result.rateLimitModifyBucketDataSuccess = "true";
    }

    // Done
    result.rateLimitModifyBucketDataRawObject = bucketData.getAllBucketData(effect.bucketId);
    return result;
}
