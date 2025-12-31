import { AngularJsComponent, AngularJsFactory, AngularJsPage, UIExtension } from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";
import { Bucket, BucketDataObject, DeleteBucketResponse, GetBucketResponse, GetBucketsResponse, GetInspectorDataResponse } from "../shared/types";
import { loadTemplate } from "./rate-limiter-template-loader";

function rateLimiterServiceFunction(backendCommunicator: any): any {
    const service: any = {};

    service.deleteBucket = (bucketId: string): DeleteBucketResponse => {
        return backendCommunicator.fireEventSync("rate-limiter:deleteBucket", { bucketId });
    };

    service.getBucket = (bucketId: string): GetBucketResponse => {
        return backendCommunicator.fireEventSync("rate-limiter:getBucket", { bucketId });
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

    service.getInspectorData = (): GetInspectorDataResponse => {
        return backendCommunicator.fireEventSync("rate-limiter:getInspectorData", {});
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
    template: loadTemplate(),
    controller: ($scope: any, backendCommunicator: any, rateLimiterService: any, ngToast: any) => {
        $scope.bucketId = "";
        $scope.bucketMap = {} as Record<string, Bucket>;
        $scope.bucketName = "";
        $scope.buckets = [];
        $scope.bucketData = "{}";
        $scope.textError = "";

        $scope.bucketHeaders = [
            {
                name: "BUCKET NAME",
                icon: "fa-bucket",
                dataField: "name",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.name }}</div>
                `
            },
            {
                name: "START TOKENS",
                icon: "fa-play",
                headerStyles: {
                    'width': '120px'
                },
                dataField: "startTokens",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.startTokens }}</div>
                `
            },
            {
                name: "MAX TOKENS",
                icon: "fa-arrow-up",
                headerStyles: {
                    'width': '120px'
                },
                dataField: "maxTokens",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.maxTokens }}</div>
                `
            },
            {
                name: "REFILL RATE",
                icon: "fa-tachometer-alt",
                headerStyles: {
                    'width': '120px'
                },
                dataField: "refillRate",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.refillRate }}/sec</div>
                `
            },
            {
                name: "PERSISTENT",
                icon: "fa-save",
                headerStyles: {
                    'width': '100px'
                },
                dataField: "persistBucket",
                sortable: true,
                cellTemplate: `
                    <div>
                        <span ng-if="data.persistBucket" style="color: #53fc18;">
                            <i class="fas fa-check"></i> Yes
                        </span>
                        <span ng-if="!data.persistBucket" class="muted">
                            <i class="fas fa-times"></i> No
                        </span>
                    </div>
                `
            },
            {
                name: "LIFETIME MAX",
                icon: "fa-infinity",
                headerStyles: {
                    'width': '120px'
                },
                dataField: "lifetimeMaxTokensValue",
                sortable: true,
                cellTemplate: `
                    <div>
                        <span ng-if="data.lifetimeMaxTokens">{{ data.lifetimeMaxTokensValue }}</span>
                        <span ng-if="!data.lifetimeMaxTokens" class="muted">Unlimited</span>
                    </div>
                `
            }
        ];

        $scope.bucketMenuOptions = (item: any) => {
            return [
                {
                    html: `<a href><i class="far fa-cog" style="margin-right: 10px;"></i> Configure Bucket</a>`,
                    click: function () {
                        $scope.addOrEditBucketButton(item.id);
                    }
                },
                {
                    html: `<a href><i class="far fa-database" style="margin-right: 10px;"></i> Inspect Bucket</a>`,
                    click: function () {
                        $scope.bucketDataEditorButton(item.id);
                    }
                },
                {
                    html: `<a href style="color: #fb7373;"><i class="far fa-trash-alt" style="margin-right: 10px;"></i> Delete Bucket</a>`,
                    click: function () {
                        $scope.removeBucketButton(item.id);
                    }
                }
            ];
        };

        $scope.inspectorBuckets = [];

        $scope.inspectorHeaders = [
            {
                name: "BUCKET NAME",
                icon: "fa-bucket",
                dataField: "name",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.name }}</div>
                `
            },
            {
                name: "TYPE",
                icon: "fa-tag",
                headerStyles: {
                    'width': '120px'
                },
                dataField: "type",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.type }}</div>
                `
            },
            {
                name: "DATA ENTRIES",
                icon: "fa-list",
                headerStyles: {
                    'width': '140px'
                },
                dataField: "dataEntryCount",
                sortable: true,
                cellTemplate: `
                    <div>{{ data.dataEntryCount }}</div>
                `
            }
        ];

        $scope.inspectorMenuOptions = (item: any) => {
            return [
                {
                    html: `<a href><i class="far fa-database" style="margin-right: 10px;"></i> Inspect Bucket</a>`,
                    click: function () {
                        $scope.bucketDataEditorButton(item.id);
                    }
                }
            ];
        };

        $scope.loadInspectorData = () => {
            const response = rateLimiterService.getInspectorData();
            if (response.errorMessage) {
                ngToast.create({
                    className: 'danger',
                    content: `Error loading inspector data: ${response.errorMessage}`
                });
                return;
            }
            $scope.inspectorBuckets = response.buckets;
        };

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
            let bucket = $scope.bucketMap[bucketId];
            if (!bucket) {
                const bucketResponse = rateLimiterService.getBucket(bucketId);
                if (bucketResponse.errorMessage || !bucketResponse.bucket) {
                    ngToast.create({
                        className: 'danger',
                        content: `Error: Bucket not found: id=${bucketId}`
                    });
                    return;
                }
                bucket = bucketResponse.bucket;
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
