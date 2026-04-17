#!/usr/bin/env node
/**
 * fixLibraryAgp.js
 *
 * Some react-native libraries ship their own `buildscript { dependencies { classpath('com.android.tools.build:gradle:X.X.X') } }`
 * block in `android/build.gradle`. With Expo SDK 54 (AGP 8.11.0, Gradle 8.13, Kotlin 2.1.20),
 * these old AGP classpath declarations conflict with the root project's AGP version and
 * cause "No variants exist" errors when the :app module tries to resolve these libraries.
 *
 * Additionally, some libraries use `com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION` inside
 * helper functions to determine namespace support. This class was removed in AGP 8.x, causing
 * the android plugin to fail to configure the module — also producing "No variants exist".
 *
 * This script:
 *   1. Strips `dependencies { ... }` from within `buildscript { ... }` so libraries inherit
 *      the AGP classpath from the root project.
 *   2. Replaces any top-level `def` function whose body references `com.android.Version` with
 *      a hardcoded `return true` (AGP 8.x always supports namespace).
 *
 * Runs via `postinstall` in package.json — so it works on EAS after `npm install`.
 */

const fs = require('fs');
const path = require('path');

const LIBRARIES = [
  'react-native-screens',
  'react-native-webview',
  'react-native-safe-area-context',
];

/** Find the index of the matching closing brace, starting just after the opening brace. */
function findMatchingClose(text, openIdx) {
  let depth = 1;
  for (let i = openIdx + 1; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function stripBuildscriptDependencies(content, filePath) {
  const bsKeywordIdx = content.search(/\bbuildscript\b/);
  if (bsKeywordIdx === -1) {
    console.log(`[fixLibraryAgp] No buildscript block: ${filePath}`);
    return content;
  }

  const bsOpenBrace = content.indexOf('{', bsKeywordIdx);
  if (bsOpenBrace === -1) return content;

  const bsCloseBrace = findMatchingClose(content, bsOpenBrace);
  if (bsCloseBrace === -1) return content;

  const buildscriptInner = content.slice(bsOpenBrace + 1, bsCloseBrace);
  const depMatch = buildscriptInner.search(/\bdependencies\s*\{/);
  if (depMatch === -1) {
    console.log(`[fixLibraryAgp] Already patched (no buildscript.dependencies): ${filePath}`);
    return content;
  }

  const depOpenBrace = buildscriptInner.indexOf('{', depMatch);
  const depCloseBrace = findMatchingClose(buildscriptInner, depOpenBrace);
  if (depCloseBrace === -1) return content;

  const newBuildscriptInner =
    buildscriptInner.slice(0, depMatch) + buildscriptInner.slice(depCloseBrace + 1);

  const patched =
    content.slice(0, bsOpenBrace + 1) +
    newBuildscriptInner +
    content.slice(bsCloseBrace);

  console.log(`[fixLibraryAgp] Stripped buildscript.dependencies: ${filePath}`);
  return patched;
}

/**
 * Find every top-level `def funcName() { ... }` whose body contains `com.android.Version`
 * and replace it with `def funcName() { return true }`.
 * Uses brace-counting so nested braces inside the function body are handled correctly.
 */
function patchComAndroidVersionUsage(content, filePath) {
  if (!content.includes('com.android.Version')) return content;

  // Match `def <name>()` followed by optional whitespace then `{`
  const defPattern = /\bdef\s+(\w+)\s*\(\s*\)\s*\{/g;
  let match;
  let result = content;
  let offset = 0; // accumulated length delta from previous replacements

  // Collect all matches first (against original content), then apply in order
  const patches = [];
  while ((match = defPattern.exec(content)) !== null) {
    const openBraceIdx = match.index + match[0].length - 1; // index of `{`
    const closeBraceIdx = findMatchingClose(content, openBraceIdx);
    if (closeBraceIdx === -1) continue;

    const body = content.slice(openBraceIdx + 1, closeBraceIdx);
    if (!body.includes('com.android.Version')) continue;

    patches.push({
      start: match.index,
      end: closeBraceIdx + 1,
      funcName: match[1],
    });
  }

  if (patches.length === 0) {
    console.log(`[fixLibraryAgp] com.android.Version already patched or no match: ${filePath}`);
    return content;
  }

  // Apply patches from last to first so earlier indices stay valid
  for (const p of patches.reverse()) {
    const replacement = `def ${p.funcName}() {\n  return true\n}`;
    result = result.slice(0, p.start) + replacement + result.slice(p.end);
    console.log(`[fixLibraryAgp] Replaced ${p.funcName}() (com.android.Version): ${filePath}`);
  }

  return result;
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[fixLibraryAgp] Not found, skipping: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  content = stripBuildscriptDependencies(content, filePath);
  content = patchComAndroidVersionUsage(content, filePath);

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  for (const lib of LIBRARIES) {
    const buildGradle = path.join(projectRoot, 'node_modules', lib, 'android', 'build.gradle');
    patchFile(buildGradle);
  }
}

main();
