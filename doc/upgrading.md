# Upgrading

This plugin uses semantic versioning to indicate compatibility changes.

- A **patch release** changes the last number (e.g. `0.0.3` -> `0.0.4`). These releases may fix bugs or add features, but your existing setup should continue to work just fine.
- A **minor release** changes the middle number (e.g. `0.0.4` -> `0.1.0`). These releases typically make considerable changes but are generally backward-compatible. Your existing setup should continue to work.
- A **major release** changes the first number (e.g. `0.1.5` -> `1.0.0`). These releases correspond to a major milestone and may contain breaking changes.

## Version Compatibility

| Plugin Version | Firebot Version |
|---|---|
| 0.1.0+ | 5.65+ |
| 0.0.7 | 5.64 |

## Upgrade Procedure

1. From the latest [Release](https://github.com/TheStaticMage/firebot-rate-limiter/releases), download `Firebot-Rate-Limiter-<version>.js`.
2. Place the new `Firebot-Rate-Limiter-<version>.js` into your Firebot scripts directory (File > Open Data Folder, then select the "scripts" directory).
3. Go to Settings > Scripts > Manage Startup Scripts, find the plugin in the list, click Edit next to it, select the new `Firebot-Rate-Limiter-<version>.js` file, and click Save.
4. Restart Firebot.

Optional: Delete any older versions of this plugin from your Firebot scripts directory to keep it clean.

## Upgrade Notes

:fire: **Upgrading to 0.1.0+**: Requires Firebot 5.65 or later. If you are running Firebot 5.64, you must remain on version 0.0.7.
