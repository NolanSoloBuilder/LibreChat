import type { TMessage } from 'librechat-data-provider';

/** Reconstruct presentation from durable messages, scoped to IDs in this exact card. */
export function selectionState(html: string, messages: TMessage[] = []) {
  const ids = new Set([...html.matchAll(/validation_id=([a-f0-9-]{36})/g)].map((m) => m[1]));
  let selected: string | null = null;
  let failed = false;
  let actionMessageId: string | undefined;
  for (const message of messages) {
    if (message.isCreatedByUser) {
      const text =
        message.text ||
        (Array.isArray(message.content)
          ? message.content.map((part) => (part?.type === 'text' ? part.text : '')).join('\n')
          : '');
      // Only action envelopes are selection evidence; ordinary prose is not an action.
      if (
        !text.startsWith('The user clicked a button in an embedded UI Resource,') &&
        !text.startsWith('执行用户卡片操作（仍须遵守工具审批要求）：\n') &&
        !text.startsWith('Run the user card action (tool approval still applies):\n')
      )
        continue;
      const id = text.match(/validation_id=([a-f0-9-]{36})/)?.[1];
      if (id && ids.has(id)) {
        selected = id;
        actionMessageId = message.messageId;
        failed = false;
      }
    } else if (
      selected &&
      (!actionMessageId || message.parentMessageId === actionMessageId) &&
      (message.error || message.content?.some((part) => part?.type === 'error'))
    ) {
      failed = true;
    }
  }
  return { selected, failed };
}

/** No parent DOM access or same-origin sandbox permission is needed. */
export const selectionHostBridge = `<style>
html[data-host-theme="light"]{color-scheme:light;--bg:#fff;--ink:#252923;--muted:#677064;--line:#e3e7df;--surface:#f5f6f2;--accent:#315b43;--good:#e8f1e9;--warn:#fff0d7}
html[data-host-theme="dark"]{color-scheme:dark;--bg:#20231f;--ink:#eef1e9;--muted:#aab3a7;--line:#3d443b;--surface:#2c322a;--accent:#a5d5af;--good:#263f2e;--warn:#463827}
.proposal[data-selected="true"]{border:2px solid var(--accent);background:var(--good)}
.selection-status{color:var(--accent);font-weight:600;margin-bottom:10px}
</style><script>
(()=>{
const buttons=[...document.querySelectorAll('button[data-prompt]')].filter(b=>/validation_id=([a-f0-9-]{36})/.test(b.dataset.prompt||''));
buttons.forEach(b=>{b.dataset.originalLabel=b.textContent;});
const show=(id,failed)=>buttons.forEach(b=>{
 const selected=(b.dataset.prompt.match(/validation_id=([a-f0-9-]{36})/)||[])[1]===id;
 const card=b.closest('.proposal');if(!card)return;
 card.dataset.selected=String(selected);b.setAttribute('aria-pressed',String(selected));
 let status=card.querySelector('.selection-status');
 if(selected){if(!status){status=document.createElement('div');status.className='selection-status';status.setAttribute('role','status');card.prepend(status);}status.textContent=failed?'Proposal selected · save incomplete':'Proposal selected · see conversation for save result';}
 else if(status)status.remove();
 b.disabled=selected&&!failed;b.textContent=selected?(failed?'Request save again':'Proposal selected'):b.dataset.originalLabel;
});
addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='ashley-host-state')return;
 const s=e.data.payload;if(!s)return;
 if(s.theme==='light'||s.theme==='dark')document.documentElement.dataset.hostTheme=s.theme;
 show(s.selected,s.failed===true);
});
})();
</script>`;
