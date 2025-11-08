import { firebot } from '../main';

export function getDataFilePath(filename: string): string {
    const { fs, path } = firebot.modules;
    const { scriptDataDir } = firebot;
    if (!fs.existsSync(scriptDataDir)) {
        fs.mkdirSync(scriptDataDir, { recursive: true });
    }

    return path.join(scriptDataDir, filename);
}
