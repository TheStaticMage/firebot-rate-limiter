// @ts-expect-error - Raw file import handled by webpack
import templateHtml from "./templates/rate-limiter.html";
// @ts-expect-error - Raw file import handled by webpack
import stylesCss from "./templates/rate-limiter-styles.css";

export const loadTemplate = (): string => {
    return `${templateHtml}\n\n<style>\n${stylesCss}\n</style>`;
};
