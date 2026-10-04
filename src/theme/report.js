export function createReport(baseFontSize) {
  const report = { version: 2, convertedRules: 0, skipped: [], resources: [], warnings: [], fontDefinitions: 0, imageReferences: 0, baseFontSize };
  return {
    report,
    skip(item, reason) { if (report.skipped.length < 200) report.skipped.push({ item, reason }); },
    warn(message) { if (report.warnings.length < 100) report.warnings.push(message); },
    missing(property, value, reason) {
      if (report.resources.length < 100) report.resources.push({ property, value: value.startsWith('data:') ? '嵌入资源' : value.slice(0, 160), reason });
    }
  };
}
