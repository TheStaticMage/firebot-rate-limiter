import { firebot } from "../main";
import { bucketFilter } from "./bucket";

export function registerFilters(): void {
    const { eventFilterManager } = firebot.modules;
    eventFilterManager.registerFilter(bucketFilter);
}
