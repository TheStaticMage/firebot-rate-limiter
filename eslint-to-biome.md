# ESLint to Biome Migration Guide

A practical guide for migrating JavaScript/TypeScript projects from ESLint to Biome, based on real-world conversion experience.

## Overview

Biome is a fast, modern toolchain that replaces ESLint and Prettier. This guide covers the key migration steps with focus on maintaining rule parity and avoiding breakage.

---

## Phase 1: Preparation

### 1.1 Inventory Your ESLint Setup

**Files to identify:**

- `.eslintrc.*` (config files)
- `.eslintignore` (ignore patterns)
- ESLint-related dependencies in `package.json`
- npm scripts using `eslint`
- CI workflows running lint checks

**Rules to audit:**

- Which ESLint rules are enabled?
- Which are warnings vs errors?
- Any custom rule configurations?
- Plugins being used (React, TypeScript, etc.)?

### 1.2 Check Biome Compatibility

Biome does not support all ESLint rules. Before migrating:

1. Review [Biome's rule coverage](https://biomejs.dev/linter/rules/)
2. Identify ESLint rules with no Biome equivalent
3. Decide: drop the rule, or keep ESLint alongside Biome?

**Common gaps:**

- Complex plugin rules (e.g., React-specific hooks rules)
- Custom ESLint plugins
- Some stylistic preferences not yet implemented

---

## Phase 2: Configuration Migration

### 2.1 Remove ESLint Files

```bash
rm .eslintrc.js .eslintignore
```

### 2.2 Create biome.json

Start with a minimal configuration and build up:

```json
{
    "$schema": "https://biomejs.dev/schemas/2.4.10/schema.json",
    "vcs": {
        "enabled": true,
        "clientKind": "git",
        "useIgnoreFile": true
    },
    "files": {
        "ignoreUnknown": false,
        "includes": ["**"]
    },
    "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 4,
        "lineEnding": "lf",
        "lineWidth": 240
    },
    "linter": {
        "enabled": true,
        "rules": {
            "recommended": false
        }
    },
    "assist": {
        "enabled": true,
        "actions": {
            "source": {
                "organizeImports": "on"
            }
        }
    }
}
```

### 2.3 Port ESLint Rules to Biome

ESLint rules map to Biome's categories:

| ESLint Category | Biome Category |
|----------------|----------------|
| Possible Errors | `correctness` |
| Best Practices | `correctness`, `suspicious` |
| Stylistic | `style`, `complexity` |
| Variables | `correctness` |

**Example porting:**

```json
// ESLint
{
    "rules": {
        "no-unused-vars": "error",
        "no-console": "warn",
        "eqeqeq": "error"
    }
}

// Biome equivalent
{
    "linter": {
        "rules": {
            "correctness": {
                "noUnusedVariables": "error"
            },
            "suspicious": {
                "noConsoleLog": "warn",
                "noDoubleEquals": "error"
            }
        }
    }
}
```

**Key differences:**

- Biome uses camelCase rule names
- No "warn" level in Biome - use "error" or "off"
- Some rules are split differently across categories

### 2.4 Configure File Includes/Excludes

Biome uses `includes` with glob patterns. Note that negation patterns start with `!`.

```json
{
    "files": {
        "includes": [
            "**",
            "!node_modules/**",
            "!dist/**",
            "!coverage/**"
        ]
    },
    "linter": {
        "includes": [
            "**",
            "!node_modules/**",
            "!*.config.js"
        ]
    }
}
```

**Important:** The `files.includes` applies to both formatter and linter unless overridden.

---

## Phase 3: Package.json Updates

### 3.1 Update Scripts

Replace ESLint commands with Biome equivalents:

```json
{
    "scripts": {
        "lint": "biome lint .",
        "lint:fix": "biome lint --write .",
        "format": "biome format --write .",
        "check": "biome check .",
        "check:fix": "biome check --write ."
    }
}
```

**Command mapping:**

| ESLint | Biome |
|--------|-------|
| `eslint .` | `biome lint .` |
| `eslint --fix .` | `biome lint --write .` |
| `prettier --write .` | `biome format --write .` |
| N/A | `biome check .` (lint + format) |

### 3.2 Update Dependencies

```bash
npm uninstall eslint prettier
npm install --save-dev @biomejs/biome
```

---

## Phase 4: Handling Formatting Changes

### 4.1 Quote Style Changes

Biome defaults to double quotes for JavaScript/TypeScript. This affects:

- String literals in code
- Import statements
- Any scripts that parse code looking for quotes

**Impact areas to check:**

- Version extraction scripts in CI workflows
- Custom build scripts that grep for patterns
- Code generation tools

**Example fix for bash scripts:**

```bash
# Before (single quotes)
script_version=$(grep '^const scriptVersion = ' src/main.ts | cut -d"'" -f2)

# After (double quotes)
script_version=$(grep '^const scriptVersion = ' src/main.ts | cut -d'"' -f2)
```

**Example fix for Node.js scripts:**

```javascript
// Before (single quotes)
content.replace(/const scriptVersion = '.*?';/, `const scriptVersion = '${version}';`)

// After (double quotes)
content.replace(/const scriptVersion = ".*?";/, `const scriptVersion = "${version}";`)
```

### 4.2 Bulk Formatting

Run Biome format once to normalize all files:

```bash
npx biome format --write .
```

Commit this separately from the configuration changes for cleaner diffs.

---

## Phase 5: Cleanup and Optimization

### 5.1 Remove Unused Patterns

After running Biome, identify and remove ignore patterns that don't match any files:

```bash
# Check which patterns actually match files
find . -name "*.vue" -type f 2>/dev/null | head -5
find . -name "*.mts" -type f 2>/dev/null | head -5
find . -path "*/.vite/*" -type f 2>/dev/null | head -5
```

Remove patterns from `biome.json` that have no matches to keep configuration clean.

### 5.2 Validate Configuration

```bash
# Check all files
npx biome check .

# Verify no errors
npx biome check --diagnostic-level=error .
```

---

## Phase 6: CI/CD Updates

### 6.1 Update GitHub Actions

Replace ESLint steps with Biome:

```yaml
# Before
- name: Run ESLint
  run: npx eslint .

# After
- name: Run Biome
  run: npx biome check .
```

### 6.2 Update Version Checks

If workflows extract version from code, update quote handling:

```yaml
- name: Extract version
  run: |
    script_version=$(grep '^const scriptVersion = ' src/main.ts | cut -d'"' -f2)
    echo "version=$script_version" >> $GITHUB_OUTPUT
```

---

## Common Pitfalls

### 1. Rule Severity Mismatch

ESLint has "warn", Biome has only "error" and "off". Decide whether to:

- Disable the rule entirely
- Make it an error

### 2. Formatter vs Linter Includes

The `files.includes` setting applies globally. Use category-specific `includes` if formatter and linter need different file sets.

### 3. VCS Integration

Enable VCS integration to respect `.gitignore`:

```json
{
    "vcs": {
        "enabled": true,
        "clientKind": "git",
        "useIgnoreFile": true
    }
}
```

This automatically excludes `node_modules`, `dist`, etc.

### 4. Overrides Path Patterns

Biome overrides use `includes` (not `files`):

```json
{
    "overrides": [
        {
            "includes": ["**/*.test.ts"],
            "linter": {
                "rules": {
                    "style": {
                        "noCommonJs": "off"
                    }
                }
            }
        }
    ]
}
```

---

## Testing the Migration

### Checklist

1. [ ] `biome check .` runs without configuration errors
2. [ ] All source files are linted (no unexpected exclusions)
3. [ ] CI workflows pass
4. [ ] Version extraction scripts work (if applicable)
5. [ ] Build scripts work
6. [ ] No ESLint dependencies remain

### Useful Commands

```bash
# Check for remaining ESLint references
grep -r "eslint" package.json .github/ --include="*.json" --include="*.yml"

# Verify Biome can parse all files
npx biome check . --diagnostic-level=error

# Count files being checked
npx biome check . 2>&1 | grep -E "^Checked"
```

---

## Migration Timeline Example

| Step | Action | Commit Message |
|------|--------|----------------|
| 1 | Remove ESLint config, add Biome config | "chore: replace ESLint with Biome" |
| 2 | Update package.json scripts | "chore: update npm scripts for Biome" |
| 3 | Bulk format all files | "style: format with Biome" |
| 4 | Fix impacted scripts/workflows | "fix: update quote handling in scripts" |
| 5 | Cleanup unused patterns | "chore: remove unused Biome patterns" |

---

## Resources

- [Biome Documentation](https://biomejs.dev/guides/)
- [ESLint to Biome Rule Mapping](https://biomejs.dev/linter/rules-sources/)
- [Configuration Reference](https://biomejs.dev/reference/configuration/)

---

## Key Takeaways

1. **Audit first**: Know your ESLint rules before migrating
2. **Quote handling**: Check all scripts that parse code for quotes
3. **CI updates**: Update version extraction and lint commands
4. **Bulk format**: Commit formatting changes separately
5. **Clean up**: Remove unused ignore patterns after migration
