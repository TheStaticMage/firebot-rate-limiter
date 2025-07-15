import { firebot, logger } from "../main";
import { checkEffect } from "./check";
import { modifyBucketDataEffect } from "./modify";

export function registerEffects(): void {
    const { effectManager } = firebot.modules;
    effectManager.registerEffect(checkEffect);
    effectManager.registerEffect(modifyBucketDataEffect);
    logger.debug("Effects registered successfully.");
}
