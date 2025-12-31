import { firebot, logger } from "../main";
import { checkEffect } from "./check";
import { modifyBucketDataEffect } from "./modify";
import { undoEffect } from "./undo";

export function registerEffects(): void {
    const { effectManager } = firebot.modules;
    effectManager.registerEffect(checkEffect);
    effectManager.registerEffect(modifyBucketDataEffect);
    effectManager.registerEffect(undoEffect);
    logger.debug("Effects registered successfully.");
}
