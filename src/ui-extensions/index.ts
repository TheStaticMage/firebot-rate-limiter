import { firebot, logger } from "../main";
import { rateLimiterExtension } from "./rate-limiter";

export function registerUIExtensions(): void {
    const { uiExtensionManager } = firebot.modules;
    if (!uiExtensionManager) {
        logger.error("UIExtensionManager is not available. Cannot register UI extensions.");
        return;
    }
    uiExtensionManager.registerUIExtension(rateLimiterExtension);
    logger.debug("UI Extensions registered successfully.");
}
