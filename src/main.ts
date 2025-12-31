import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { ApprovalService } from './backend/approval-service';
import { bucketData, initializeBucketData } from './backend/bucket-data';
import { bucketService, initializeBucketService } from './backend/bucket-service';
import { registerEffects } from './effects';
import { registerEventSource } from './events';
import { registerFilters } from './filters';
import { ScriptSettings } from './shared/types';
import { registerUIExtensions } from './ui-extensions';
import { registerReplaceVariables } from './variables';

export let firebot: RunRequest<any>;
export let logger: Logger;
export let approvalService: ApprovalService;

function initializeApprovalService(): void {
    if (!approvalService) {
        approvalService = new ApprovalService(bucketService, bucketData);
        logger.debug("ApprovalService initialized.");
    } else {
        logger.debug("ApprovalService already initialized.");
    }
}

const scriptVersion = '0.1.1';

const script: Firebot.CustomScript<ScriptSettings> = {
    getScriptManifest: () => {
        return {
            name: 'Rate Limiter',
            description: 'A basic Firebot custom script for rate limiting actions.',
            author: 'The Static Mage',
            version: scriptVersion,
            startupOnly: true,
            firebotVersion: '5'
        };
    },
    getDefaultParameters: () => {
        return {};
    },
    run: (runRequest) => {
        firebot = runRequest;
        logger = runRequest.modules.logger;

        // Make sure we have a sufficiently recent version of Firebot.
        if (!runRequest || !runRequest.firebot || !runRequest.firebot.version) {
            throw new Error("Firebot version information is not available.");
        }

        const firebotVersion = runRequest.firebot.version;
        const firebotParts = firebotVersion.split('.');
        const majorVersion = parseInt(firebotParts[0], 10);
        const minorVersion = parseInt(firebotParts[1] || '0', 10);
        if (isNaN(majorVersion) || isNaN(minorVersion) || majorVersion < 5 || (majorVersion === 5 && minorVersion < 65)) {
            const { frontendCommunicator } = runRequest.modules;
            frontendCommunicator.send("error", `The installed version of Firebot Rate Limiter requires Firebot 5.65 or later. You are running Firebot ${firebotVersion}. Please update Firebot to use this plugin.`);
            return;
        }

        logger.info(`Starting Rate Limiter v${scriptVersion} on Firebot v${firebotVersion}`);
        initializeBucketService();
        initializeBucketData();
        initializeApprovalService();
        registerEffects();
        registerEventSource();
        registerFilters();
        registerReplaceVariables();
        registerUIExtensions();
    },
    stop: () => {
        if (approvalService) {
            approvalService.shutdown();
        }
        logger.info('Rate Limiter stopped');
    }
};

export default script;
