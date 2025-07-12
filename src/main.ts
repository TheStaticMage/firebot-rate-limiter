import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { initializeBucketService } from './backend/bucket-service';
import { registerUIExtensions } from './ui-extensions';
import { initializeBucketData } from './backend/bucket-data';
import { registerEffects } from './effects';
import { registerEventSource } from './events';
import { registerReplaceVariables } from './variables';

export let firebot: RunRequest<any>;
export let logger: Logger;

const scriptVersion = '0.0.1';

const script: Firebot.CustomScript = {
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
        initializeBucketService();
        initializeBucketData();
        registerUIExtensions();
        registerEffects();
        registerEventSource();
        registerReplaceVariables();
    }
};

export default script;
