import { firebot, logger } from '../main';

declare const SCRIPTS_DIR: string; // Old method for compatibility

export function getDataFilePath(filename: string): string {
    const { fs, path } = firebot.modules;
    const filepath = `script-data/firebot-rate-limiter/${filename}`; // Old path for compatibility
    let result = "";

    try {
        // Requires a version of Firebot that exposes the script directory.
        // See https://github.com/crowbartools/Firebot/issues/3180
        const { path, scriptDataDir } = firebot.modules;
        result = path.join(scriptDataDir, filename);
        logger.debug(`Got data file path from scriptDataDir: ${scriptDataDir}`);
    } catch (error) {
        // Fall back to the legacy method, compatible with older versions of Firebot.
        const profileDirectory = path.join(SCRIPTS_DIR, '..');
        const pathSplit = filepath.split('/');
        result = path.join(profileDirectory, ...pathSplit);
        logger.debug(`Got data file path from legacy method: ${result} (error: ${error})`);
    }

    const dir = path.dirname(result);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    return result;
}
