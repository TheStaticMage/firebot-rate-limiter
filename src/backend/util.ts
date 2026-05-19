import * as fs from "node:fs";
import * as path from "node:path";
import { firebot } from "../main";

export function getDataFilePath(filename: string): string {
    const { scriptDataDir } = firebot;
    if (!fs.existsSync(scriptDataDir)) {
        fs.mkdirSync(scriptDataDir, { recursive: true });
    }

    return path.join(scriptDataDir, filename);
}
