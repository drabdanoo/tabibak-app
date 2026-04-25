/**
 * withFirebaseFix.js
 * Robustly inject CLANG_ALLOW_NON_MODULAR_INCLUDES inside the post_install block.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '# withFirebaseFix: CLANG_ALLOW_NON_MODULAR_INCLUDES';

const INJECTED_LINES = [
  '  ' + PATCH_MARKER,
  '  installer.pods_project.targets.each do |target|',
  '    target.build_configurations.each do |config|',
  "      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
  '    end',
  '  end',
];

module.exports = function withFirebaseFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        console.warn('[withFirebaseFix] Podfile not found, skipping patch');
        return config;
      }

      const contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(PATCH_MARKER)) {
        return config; // already patched
      }

      const lines = contents.split('\n');
      const startIdx = lines.findIndex((l) => /\bpost_install\b\s+do/.test(l));
      if (startIdx < 0) {
        console.warn('[withFirebaseFix] post_install block not found, skipping');
        return config;
      }

      // Find the first bare 'end' after the post_install line. Expo's Podfile
      // keeps post_install as the last block, so this should be the block end.
      let endIdx = -1;
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (/^\s*end\s*$/.test(lines[i])) {
          endIdx = i;
          break;
        }
      }
      if (endIdx < 0) {
        console.warn('[withFirebaseFix] Could not locate end of post_install, skipping');
        return config;
      }

      lines.splice(endIdx, 0, ...INJECTED_LINES);
      fs.writeFileSync(podfilePath, lines.join('\n'), 'utf8');
      console.log('[withFirebaseFix] Injected CLANG_ALLOW_NON_MODULAR_INCLUDES into post_install');
      return config;
    },
  ]);
};
