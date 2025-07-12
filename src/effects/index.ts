import { firebot, logger } from "../main";
import { checkEffect } from "./check";

export function registerEffects(): void {
    const { effectManager } = firebot.modules;
    effectManager.registerEffect(checkEffect);
    logger.debug("Effects registered successfully.");
}
