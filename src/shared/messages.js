export async function send(type, fields = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...fields });
  if (!result?.ok) throw new Error(result?.error || '扩展后台暂时不可用，请重新加载扩展。');
  return result.value;
}

export function reportText(report) {
  if (!report) return '';
  const lines = [`已生成 ${report.convertedRules} 条正文规则；rem 基准 ${report.baseFontSize}px。`, `跳过 ${report.skipped.length} 项；资源依赖 ${report.resources.length} 项。`];
  for (const item of report.skipped.slice(0, 30)) lines.push(`• ${item.item}：${item.reason}`);
  for (const item of report.resources.slice(0, 10)) lines.push(`• ${item.property}：${item.reason}`);
  lines.push(`可加载字体定义 ${report.fontDefinitions ?? 0} 个；背景图片引用 ${report.imageReferences ?? 0} 个。`);
  for (const warning of report.warnings ?? []) lines.push(`• ${warning}`);
  return lines.join('\n');
}
