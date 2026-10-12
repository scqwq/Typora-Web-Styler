import { preparePackageTheme } from './zip-package.js';
import { validateFiles } from './resources.js';
import { compileTheme } from './compiler.js';

// Run the same preparation and conversion checks as import, without writing storage.
export function inspectPackageTheme(files, entry) {
  try {
    const prepared = preparePackageTheme(files, entry);
    const validated = validateFiles(prepared.resources.files);
    const compiled = compileTheme(prepared.source, {
      bundle: { sourcePath: prepared.resources.sourcePath, files: validated.files },
      settings: { enableFonts: true, enableBackgroundImages: true, useThemeBackground: true }
    });
    return { ok: true, prepared, bytes: new TextEncoder().encode(prepared.source).length,
      dependencies: prepared.dependencies, resourceCount: validated.files.length,
      rules: compiled.report.convertedRules, report: compiled.report };
  } catch (error) { return { ok: false, error: error.message }; }
}
