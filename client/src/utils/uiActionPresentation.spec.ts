import { getUIActionDisplayText, formatUIActionMessage } from './uiActionPresentation';
const wrap = (
  prompt: string,
) => `The user clicked a button in an embedded UI Resource, and we got a message of type \`prompt\`.
The prompt is:

\`\`\`
${prompt}
\`\`\`

Execute the intention of the prompt that is mentioned in the message using the tools available to you.
    `;
describe('card action presentation', () => {
  it('summarizes legacy save without disclosing execution identifiers', () => {
    expect(
      getUIActionDisplayText(
        wrap(
          '请保存选品任务 29d0319f-9385-4573-9a24-eebce3c67cf5 需求版本 3 的方案2，validation_id=private，idempotency_key=private。请调用保存工具并等待平台人工确认。',
        ),
      ),
    ).toBe('Select proposal 2 and request save');
  });
  it('shows business values for revisions and handles malformed input', () => {
    const prefix = '修改现有选品任务并重新评估，请使用以下需求，不新建任务：';
    expect(
      getUIActionDisplayText(
        wrap(
          prefix +
            JSON.stringify({ task_id: 'private', brief: { budget: 22000, deadline_days: 30 } }),
        ),
      ),
    ).toBe('Update assortment brief and reevaluate: budget CNY 22,000, delivery within 30 days');
    expect(getUIActionDisplayText(wrap(prefix + '{'))).toBe('Update assortment brief and reevaluate');
  });
  it('does not alter ordinary text or partial quoted envelopes', () => {
    expect(getUIActionDisplayText('请保存方案2，validation_id=123')).toBeNull();
    expect(getUIActionDisplayText('解释这段文字：' + wrap('test'))).toBeNull();
  });
  it('hides unknown action details without changing stored input', () => {
    const input = wrap('private tool parameters');
    expect(getUIActionDisplayText(input)).toBe('Card action submitted');
    expect(input).toContain('private tool parameters');
  });
});

it('separates new action labels from the unchanged execution payload', () => {
  const action = { type: 'prompt', payload: { prompt: 'validation_id=private' } };
  const stored = formatUIActionMessage(action, '选择方案二并申请保存');
  expect(getUIActionDisplayText(stored)).toBe('Select proposal 2 and request save');
  expect(stored).toContain('validation_id=private');
});
