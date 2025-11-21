import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { initializeBucketData } from './backend/bucket-data';
import { bucketService, initializeBucketService } from './backend/bucket-service';
import { registerEffects } from './effects';
import { registerEventSource } from './events';
import { registerFilters } from './filters';
import { ScriptSettings } from './shared/types';
import { registerUIExtensions } from './ui-extensions';
import { registerReplaceVariables } from './variables';

export let firebot: RunRequest<any>;
export let logger: Logger;
let uiExtensionDisplayed: boolean;

const scriptVersion = '0.1.0';

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
        return {
            advancedBuckets: {
                type: "boolean",
                title: "Enable Advanced Buckets",
                description: "Enable advanced bucket features for more control over rate limiting.",
                default: false,
                tip: "This will allow for buckets that persist across sessions, have a cap on maximum lifetime tokens, and more, at the expense of having to manage these buckets in a separate interface."
            }
        };
    },
    parametersUpdated: (settings: ScriptSettings) => {
        if (settings.advancedBuckets) {
            logger.info('Advanced Buckets enabled.');
            if (!uiExtensionDisplayed) {
                registerUIExtensions();
                uiExtensionDisplayed = true;
            }
        } else {
            logger.info('Advanced Buckets disabled.');
            if (uiExtensionDisplayed) {
                const { frontendCommunicator } = firebot.modules;
                frontendCommunicator.send(
                    'error',
                    'Advanced bucket features have been successfully disabled. However, due to limitations, the "Rate Limiter" item in the left sidebar will remain visible until Firebot is restarted.'
                );
            }
        }

        bucketService.setAdvancedBucketsEnabled(settings.advancedBuckets);
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
        registerEffects();
        registerEventSource();
        registerFilters();
        registerReplaceVariables();

        const settings = runRequest.parameters;
        if (settings.advancedBuckets) {
            registerUIExtensions();
            uiExtensionDisplayed = true;
            bucketService.setAdvancedBucketsEnabled(settings.advancedBuckets);
        }
    }
};

export default script;
