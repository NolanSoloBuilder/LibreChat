const ACTION_PREFIX = 'Run the user card action (tool approval still applies):\n';
const LEGACY_ACTION_PREFIX = '执行用户卡片操作（仍须遵守工具审批要求）：\n';

export function formatUIActionMessage(action: unknown, displayText: string): string {
  return ACTION_PREFIX + JSON.stringify({ version: 1, displayText, action });
}

/** Presentation only: keep the original action message intact for execution/replay.
 * Match the complete host-authored envelope, never redact arbitrary user prose.
 */
export function getUIActionDisplayText(text: string): string | null {
  const prefix = [ACTION_PREFIX, LEGACY_ACTION_PREFIX].find((value) => text.startsWith(value));
  if (prefix) {
    try {
      const value = JSON.parse(text.slice(prefix.length));
      if (
        value.version === 1 &&
        typeof value.displayText === 'string' &&
        value.displayText.trim().length > 0 &&
        value.displayText.length <= 256
      ) {
        const legacySelection = value.displayText.match(/^选择方案([一二三\d]+)并申请保存$/);
        if (legacySelection) {
          const number = ({ 一: '1', 二: '2', 三: '3' } as Record<string, string>)[legacySelection[1]] ?? legacySelection[1];
          return `Select proposal ${number} and request save`;
        }
        return value.displayText;
      }
    } catch {
      /* Fall through: never hide ordinary malformed user text. */
    }
  }
  const match = text
    .trim()
    .match(
      /^The user clicked a button in an embedded UI Resource, and we got a message of type `(prompt|intent|tool)`\.\n([\s\S]*)\nExecute the (?:intention of the prompt|intent|tool) that is mentioned in the message using the tools available to you\.$/,
    );
  if (!match) {
    return null;
  }
  const prompt = match[2].match(/^The prompt is:\n\n```\n([\s\S]*)\n```\n$/)?.[1];
  if (prompt) {
    const selection = prompt.match(
      /^请保存选品任务 [\da-f-]+ 需求版本 \d+ 的方案(\d+)，validation_id=/i,
    );
    if (selection) {
      return `Select proposal ${selection[1]} and request save`;
    }
    const updatePrefix = '修改现有选品任务并重新评估，请使用以下需求，不新建任务：';
    if (prompt.startsWith(updatePrefix)) {
      try {
        const { brief } = JSON.parse(prompt.slice(updatePrefix.length));
        const changes: string[] = [];
        if (Number.isFinite(brief?.budget) && brief.budget > 0) {
          changes.push(`budget CNY ${brief.budget.toLocaleString('en-US')}`);
        }
        if (Number.isFinite(brief?.deadline_days) && brief.deadline_days > 0) {
          changes.push(`delivery within ${brief.deadline_days} days`);
        }
        return `Update assortment brief and reevaluate${changes.length ? `: ${changes.join(', ')}` : ''}`;
      } catch {
        return 'Update assortment brief and reevaluate';
      }
    }
  }
  return 'Card action submitted';
}
