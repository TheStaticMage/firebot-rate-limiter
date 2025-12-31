import { AngularJsComponent, AngularJsFactory, AngularJsPage, UIExtension } from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";
import { Bucket, BucketDataObject, DeleteBucketResponse, GetBucketsResponse } from "../shared/types";

function rateLimiterServiceFunction(backendCommunicator: any): any {
    const service: any = {};

    service.deleteBucket = (bucketId: string): DeleteBucketResponse => {
        return backendCommunicator.fireEventSync("rate-limiter:deleteBucket", { bucketId });
    };

    service.getBuckets = (): GetBucketsResponse => {
        return backendCommunicator.fireEventSync("rate-limiter:getBuckets", {});
    };

    service.getBucketData = (bucketId: string): BucketDataObject => {
        return backendCommunicator.fireEventSync("rate-limiter:getBucketData", { bucketId });
    };

    service.saveBucket = (bucketId: string, bucket: Bucket): GetBucketsResponse => {
        const data = { ...bucket, name: bucket.name.trim() };
        return backendCommunicator.fireEventSync("rate-limiter:saveBucket", { bucketId: bucketId, bucket: data });
    };

    return service;
}

const rateLimiterService: AngularJsFactory = {
    name: "rateLimiterService",
    function: (backendCommunicator: any) => rateLimiterServiceFunction(backendCommunicator)
};

const rateLimiterAddOrEditBucket: AngularJsComponent = {
    name: "rateLimiterAddOrEditBucket",
    bindings: {
        bucketId: "<",
        bucketName: "=",
        bucketStartTokens: "=",
        bucketMaxTokens: "=",
        bucketRefillRate: "=",
        bucketFillFromStart: "=",
        bucketLifetimeMaxTokens: "=",
        bucketLifetimeMaxTokensValue: "=",
        persistBucket: "=",
        fillBucketAcrossRestarts: "=",
        saveButton: "&",
        cancelButton: "&"
    },
    template: `
        <div id="rateLimiterAddOrEditBucket" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title" ng-if="$ctrl.bucketId !== ''">Configure Bucket</h3>
                <h3 class="modal-title" ng-if="$ctrl.bucketId === ''">Add New Bucket</h3>
            </div>
            <div class="modal-body" style="width: 100%;">
                <div class="form-group">
                    <firebot-input input-title="Bucket Name" model="$ctrl.bucketName" required disable-variables="true" />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Start Tokens" model="$ctrl.bucketStartTokens" data-type="number" required disable-variables="true" tooltip="The number of tokens to start with in the bucket at the time that bucket is first used." />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Max Tokens" model="$ctrl.bucketMaxTokens" data-type="number" required disable-variables="true" tooltip="The maximum number of tokens the bucket can hold. It will not be replenished beyond this point." />
                </div>
                <div class="form-group">
                    <firebot-input input-title="Refill Rate (tokens/sec)" model="$ctrl.bucketRefillRate" data-type="number" required disable-variables="true" tooltip="This value does not have to be an integer. It can be a decimal number (e.g. 0.5) if desired." />
                </div>
                <div class="form-group">
                    <firebot-checkbox label="Lifetime Max Tokens" model="$ctrl.bucketLifetimeMaxTokens" tooltip="If checked, this will limit the total number of tokens that can be generated for this bucket." />
                </div>
                <div class="form-group" ng-if="$ctrl.bucketLifetimeMaxTokens">
                    <firebot-input input-title="Lifetime Max Tokens" model="$ctrl.bucketLifetimeMaxTokensValue" data-type="number" required disable-variables="true" />
                </div>
                <div class="form-group">
                    <firebot-checkbox label="Fill from Firebot startup" model="$ctrl.bucketFillFromStart" tooltip="If checked, token replenishment will occur from the start of the stream (when Firebot is opened). This is different from the default behavior, where token replenishment begins after the first request." />
                </div>
                <div class="form-group">
                    <firebot-checkbox label="Persist bucket data across Firebot restarts" model="$ctrl.persistBucket" tooltip="If checked, the bucket data will be saved to a file and restored across Firebot restarts." />
                </div>
                <div class="form-group" ng-if="$ctrl.persistBucket">
                    <firebot-checkbox label="Fill across Firebot restarts" model="$ctrl.fillBucketAcrossRestarts" tooltip="If checked, token replenishment will be simulated across streams and Firebot restarts, as if Firebot had not ever been shut down." />
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Cancel</button>
                    <button class="btn btn-primary" ng-click="$ctrl.saveButton()">Save</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const rateLimiterEditBucketData: AngularJsComponent = {
    name: "rateLimiterEditBucketData",
    bindings: {
        bucketId: "<",
        bucketName: "<",
        bucketData: "=",
        textError: "<",
        closeButton: "&",
        formatDataButton: "&",
        saveDataButton: "&"
    },
    template: `
        <div id="rateLimiterEditBucketData" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title">Edit Bucket Data - {{$ctrl.bucketName}}</h3>
            </div>
            <div class="modal-body" style="width: 100%;">
                <div class="modal-subheader" style="padding: 0 0 4px 0">
                    BUCKET DATA
                </div>
                <div style="width: 100%; position: relative;">
                    <div class="form-group" ng-class="{'has-error': $ctrl.textError }" style="margin-bottom: 0;">
                        <textarea id="textField" ng-model="$ctrl.bucketData" class="form-control" name="text" placeholder="Enter text" rows="8" cols="40" aria-describedby="textHelpBlock"></textarea>
                        <span id="textHelpBlock" class="help-block" ng-show="$ctrl.textError != ''">{{ $ctrl.textError }}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.closeButton()">Cancel</button>
                    <button class="btn btn-primary" ng-click="$ctrl.formatDataButton()">Format</button>
                    <button class="btn btn-primary" ng-click="$ctrl.saveDataButton()">Save</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const rateLimiterDeleteConfirmation: AngularJsComponent = {
    name: "rateLimiterDeleteConfirmation",
    bindings: {
        bucketName: "<",
        cancelButton: "&",
        deleteButton: "&"
    },
    template: `
        <div id="rateLimiterDeleteConfirmation" class="modal-content" style="width:600px; min-height:unset; padding:5px 0; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="modal-header" style="text-align: center; width: 100%;">
                <h3 class="modal-title">Confirm Bucket Deletion</h3>
            </div>
            <div class="modal-body" style="text-align: center; width: 100%;">
                <div class="form-group">
                    <p>Are you sure you want to delete the bucket "<strong>{{$ctrl.bucketName}}</strong>"?</p>
                    <p class="muted">This action cannot be undone. Any rate limits using this bucket will break.</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; width: 100%; margin-top: 20px;">
                    <button class="btn btn-default" ng-click="$ctrl.cancelButton()">Cancel</button>
                    <button class="btn btn-danger" ng-click="$ctrl.deleteButton()">Delete</button>
                </div>
            </div>
        </div>
    `,
    controller: () => {
        // No additional logic needed in the controller
    }
};

const rateLimiterPage: AngularJsPage = {
    id: "rateLimiterPage",
    name: "Rate Limiter",
    icon: "fa-stopwatch",
    type: "angularjs",
    template: `
        <div class="modal-body">
            <eos-container header="Buckets">
                <p class="help-text">Create at least one bucket for each action that you want to limit.</p>
                <p class="help-text">You can name the buckets whatever you want. You can rename them or change their parameters at any time.</p>

                <div class="list-group" style="margin-bottom: 0;">
                    <div class="list-group-item flex-row-center jspacebetween" ng-repeat="bucket in buckets track by bucket.id">
                        <div>
                            <h4 class="list-group-item-heading">{{bucket.name}}</h4>
                            <p class="list-group-item-text muted">
                                <span ng-if="bucket.persistBucket">Persisted,</span>
                                Start Tokens: {{bucket.startTokens}},
                                Max Tokens: {{bucket.maxTokens}},
                                Refill Rate: {{bucket.refillRate}},
                                Lifetime Max: {{bucket.lifetimeMaxTokens}}
                            </p>
                        </div>
                        <div style="font-size:17px">
                            <button class="btn btn-default" style="margin-right: 10px" ng-click="bucketDataEditorButton(bucket.id)">View/Edit Bucket Data</button>
                            <button class="btn btn-default" style="margin-right: 10px" ng-click="addOrEditBucketButton(bucket.id)">Configure Bucket</button>
                            <span uib-tooltip="Remove Bucket" tooltip-append-to-body="true" class="clickable" style="color:red;" ng-click="removeBucketButton(bucket.id)">
                                <i class="fas fa-trash-alt"></i>
                            </span>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <button type="button" class="btn btn-primary pull-left" ng-click="addOrEditBucketButton()">Add New Bucket</button>
                </div>
            </eos-container>
        </div>
        <div class="modal-body" ng-if="displayDeleteConfirmation">
            <rate-limiter-delete-confirmation
                bucket-id="bucketId"
                bucket-name="bucketName"
                delete-button="deleteButton(bucketId)"
                cancel-button="cancelButton()" />
        </div>
        <div class="modal-body" ng-if="displayAddOrEditBucket">
            <rate-limiter-add-or-edit-bucket
                bucket-id="bucketId"
                bucket-name="bucketName"
                bucket-start-tokens="bucketStartTokens"
                bucket-max-tokens="bucketMaxTokens"
                bucket-refill-rate="bucketRefillRate"
                bucket-fill-from-start="bucketFillFromStart"
                bucket-lifetime-max-tokens="bucketLifetimeMaxTokens"
                bucket-lifetime-max-tokens-value="bucketLifetimeMaxTokensValue"
                persist-bucket="persistBucket"
                fill-bucket-across-restarts="fillBucketAcrossRestarts"
                save-button="saveButton(bucketId, bucketName, bucketStartTokens, bucketMaxTokens, bucketRefillRate, bucketFillFromStart, bucketLifetimeMaxTokens, bucketLifetimeMaxTokensValue, persistBucket, fillBucketAcrossRestarts)"
                cancel-button="cancelButton()" />
        </div>
        <div class="modal-body" ng-if="displayEditBucketData">
            <rate-limiter-edit-bucket-data
                bucket-id="bucketId"
                bucket-name="bucketName"
                bucket-data="bucketData"
                text-error="textError"
                close-button="cancelButton()"
                format-data-button="formatDataButton(bucketData)"
                save-data-button="saveDataButton(bucketId, bucketData)" />
        </div>
    `,
    controller: ($scope: any, backendCommunicator: any, rateLimiterService: any, ngToast: any) => {
        $scope.bucketId = "";
        $scope.bucketMap = {} as Record<string, Bucket>;
        $scope.bucketName = "";
        $scope.buckets = [];
        $scope.bucketData = "{}";
        $scope.textError = "";

        $scope.setBucketDataField = (formattedData: string) => {
            // Force update both scope and DOM element
            $scope.bucketData = formattedData;
            $scope.$evalAsync(() => {
                // Also directly update the DOM element to ensure it reflects the change
                const textField = document.getElementById('textField') as HTMLTextAreaElement;
                if (textField) {
                    textField.value = formattedData;
                    // Trigger input event to sync with AngularJS
                    textField.dispatchEvent(new Event('input'));
                }
            });
        };

        $scope.addOrEditBucketButton = (bucketId?: string) => {
            const bucket = bucketId ? $scope.bucketMap[bucketId] || {} : {};
            $scope.bucketId = bucketId || "";
            $scope.bucketName = bucket.name || "";
            $scope.bucketStartTokens = bucket.startTokens === undefined ? 100 : bucket.startTokens;
            $scope.bucketMaxTokens = bucket.maxTokens === undefined ? 100 : bucket.maxTokens;
            $scope.bucketRefillRate = bucket.refillRate === undefined ? 0.5 : bucket.refillRate;
            $scope.bucketFillFromStart = bucket.fillFromStart === true;
            $scope.bucketLifetimeMaxTokens = bucket.lifetimeMaxTokens === true;
            $scope.bucketLifetimeMaxTokensValue = bucket.lifetimeMaxTokensValue === undefined ? 999999999 : bucket.lifetimeMaxTokensValue;
            $scope.persistBucket = bucket.persistBucket !== undefined ? bucket.persistBucket : false;
            $scope.fillBucketAcrossRestarts = bucket.fillBucketAcrossRestarts === true;
            $scope.cancelButton();
            $scope.displayAddOrEditBucket = true;
        };

        $scope.bucketDataEditorButton = (bucketId: string) => {
            const bucket = $scope.bucketMap[bucketId];
            if (!bucket) {
                ngToast.create({
                    className: 'danger',
                    content: `Error: Bucket not found: id=${bucketId}`
                });
                return;
            }

            const bucketData = rateLimiterService.getBucketData(bucketId);
            if (bucketData.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error fetching bucket data: ${bucketData.errorMessage}`
                });
                return;
            }

            $scope.bucketId = bucketId;
            $scope.bucketName = bucket.name || "Unknown Bucket";
            $scope.textError = "";
            $scope.cancelButton();
            $scope.displayEditBucketData = true;
            $scope.setBucketDataField(JSON.stringify(bucketData.bucketData, null, 4));
        };

        $scope.cancelButton = () => {
            $scope.displayAddOrEditBucket = false;
            $scope.displayDeleteConfirmation = false;
            $scope.displayEditBucketData = false;
        };
        $scope.cancelButton();

        $scope.deleteButton = (bucketId: string) => {
            $scope.cancelButton();

            const response = rateLimiterService.deleteBucket(bucketId);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error deleting bucket: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Bucket "${$scope.bucketName}" deleted successfully.`
            });

            $scope.updateBucketList(response.buckets);
        };

        $scope.removeBucketButton = (bucketId: string) => {
            $scope.cancelButton();
            $scope.bucketId = bucketId;
            $scope.bucketName = $scope.buckets.find((b: any) => b.id === bucketId)?.name || "Unknown Bucket";
            $scope.displayDeleteConfirmation = true;
        };

        $scope.saveButton = (bucketIdIn: string, bucketName: string, bucketStartTokens: number, bucketMaxTokens: number, bucketRefillRate: number, bucketFillFromStart: boolean, bucketLifetimeMaxTokens: boolean, bucketLifetimeMaxTokensValue: number, persistBucket: boolean, fillBucketAcrossRestarts: boolean) => {
            const bucketId = bucketIdIn || crypto.randomUUID();
            const data: Bucket = {
                name: bucketName.trim(),
                type: 'advanced',
                startTokens: bucketStartTokens,
                maxTokens: bucketMaxTokens,
                refillRate: bucketRefillRate,
                fillFromStart: bucketFillFromStart,
                lifetimeMaxTokens: bucketLifetimeMaxTokens,
                lifetimeMaxTokensValue: bucketLifetimeMaxTokensValue,
                persistBucket: persistBucket,
                fillBucketAcrossRestarts: fillBucketAcrossRestarts
            };

            const response = rateLimiterService.saveBucket(bucketId, data);
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error saving bucket: ${response.errorMessage}`
                });
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Bucket "${bucketName}" saved successfully.`
            });

            $scope.updateBucketList(response.buckets);
            $scope.displayAddOrEditBucket = false;
        };

        $scope.formatDataButton = (bucketData: string) => {
            try {
                const parsedData = JSON.parse(bucketData);
                const formattedData = JSON.stringify(parsedData, null, 4);
                $scope.setBucketDataField(formattedData);
            } catch (error) {
                $scope.textError = error instanceof Error ? error.message : String(error);
                return;
            }

            const result = backendCommunicator.fireEventSync("rate-limiter:saveBucketData", { bucketId: "", bucketData: bucketData, dryRun: true });
            $scope.textError = result.errorMessage || "";
        };

        $scope.saveDataButton = (bucketId: string, bucketData: string) => {
            const result = backendCommunicator.fireEventSync("rate-limiter:saveBucketData", { bucketId: bucketId, bucketData: bucketData, dryRun: false });
            if (result.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: "Error saving bucket data!"
                });
                $scope.textError = result.errorMessage;
                return;
            }

            ngToast.create({
                className: 'success',
                content: `Bucket data for "${$scope.bucketName}" saved successfully.`
            });

            $scope.cancelButton();
        };

        $scope.getBuckets = () => {
            const response = rateLimiterService.getBuckets();
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error fetching buckets: ${response.errorMessage}`
                });
                return;
            }
            $scope.updateBucketList(response.buckets);
        };

        $scope.updateBucketList = (buckets: Record<string, Bucket>): void => {
            $scope.bucketMap = buckets;
            const bucketArray = Object.entries(buckets)
                .map(([id, bucket]) => ({
                    ...(bucket),
                    id
                }))
                .filter(bucket => bucket.type !== 'simple');
            bucketArray.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            $scope.buckets = bucketArray;
        };

        $scope.getBuckets();
    }
};

export const rateLimiterExtension: UIExtension = {
    id: "rateLimiterExtension",
    pages: [rateLimiterPage],
    providers: {
        components: [rateLimiterAddOrEditBucket, rateLimiterDeleteConfirmation, rateLimiterEditBucketData],
        factories: [rateLimiterService]
    }
};
