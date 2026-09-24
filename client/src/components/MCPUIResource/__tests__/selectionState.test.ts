import type { TMessage } from 'librechat-data-provider';
import { selectionState } from '../selectionState';
const a = '2a63eab8-a11b-4418-ab65-35183c7def08';
const b = '3a63eab8-a11b-4418-ab65-35183c7def08';
const html = `validation_id=${a} validation_id=${b}`;
const message = (text: string, isCreatedByUser = true, error = false) =>
  ({ text, isCreatedByUser, error }) as TMessage;
const action = (id: string) =>
  message(`The user clicked a button in an embedded UI Resource, validation_id=${id}`);
it('restores the latest choice only within the current card, including after reload', () => {
  const history = [action(a), action(b)];
  expect(selectionState(html, JSON.parse(JSON.stringify(history)))).toEqual({
    selected: b,
    failed: false,
  });
  expect(selectionState(`validation_id=${a}`, [action(b)])).toEqual({
    selected: null,
    failed: false,
  });
});
it('does not mistake ordinary text or a failed save for saved business state', () => {
  expect(selectionState(html, [message(`validation_id=${a}`)]).selected).toBeNull();
  expect(selectionState(html, [action(a), message('failed', false, true)])).toEqual({
    selected: a,
    failed: true,
  });
  expect(selectionState(html, [action(a), message('failed', false, true), action(b)])).toEqual({
    selected: b,
    failed: false,
  });
});
it('supports new structured actions and text content parts', () => {
  expect(
    selectionState(html, [
      message(
        '执行用户卡片操作（仍须遵守工具审批要求）：\n' +
          JSON.stringify({ action: { payload: { prompt: `validation_id=${a}` } } }),
      ),
    ]).selected,
  ).toBe(a);
});
