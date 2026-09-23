import { UIResourceRenderer as LegacyUIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';
import { ThemeContext } from '@librechat/client';
import { useOptionalMessagesOperations } from '~/Providers';
import { selectionState, selectionHostBridge } from './selectionState';

type LegacyRendererProps = ComponentProps<typeof LegacyUIResourceRenderer>;

type UIResourceRendererProps = Omit<
  LegacyRendererProps,
  'resource' | 'remoteDomProps' | 'supportedContentTypes'
> & {
  resource: UIResource;
};

export function isSupportedUIResource(
  resource: UIResource | null | undefined,
): resource is UIResource {
  return (
    typeof resource?.mimeType === 'string' &&
    resource.mimeType.split(';', 1)[0].trim().toLowerCase() === 'text/html'
  );
}

/** Restricts legacy MCP-UI rendering to sandboxed inline HTML resources. */
export default function UIResourceRenderer({
  resource,
  htmlProps,
  ...props
}: UIResourceRendererProps) {
  const { resolvedMode } = useContext(ThemeContext);
  const { getMessages } = useOptionalMessagesOperations();
  const frame = useRef<HTMLIFrameElement>(null);
  const isSelection = resource.uri?.startsWith('ui://ashley-selection/') === true;
  const html = typeof resource.text === 'string' ? resource.text : '';
  const { selected, failed } = isSelection
    ? selectionState(html, getMessages())
    : { selected: null, failed: false };
  const postState = useCallback(
    () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: 'ashley-host-state',
          payload: { theme: resolvedMode, selected, failed },
        },
        '*',
      ),
    [resolvedMode, selected, failed],
  );
  useEffect(postState, [postState, html]);
  const bridgedHtml = useMemo(
    () => (isSelection ? html.replace('</body>', selectionHostBridge + '</body>') : html),
    [html, isSelection],
  );

  if (!isSupportedUIResource(resource)) {
    return null;
  }

  const safeResource: UIResource = { ...resource, ...(isSelection ? { text: bridgedHtml } : {}) };
  const safeHtmlProps = { ...htmlProps };
  delete safeResource.contentType;
  safeResource.mimeType = 'text/html';
  delete safeHtmlProps.sandboxPermissions;
  if (isSelection) {
    const originalLoad = safeHtmlProps.iframeProps?.onLoad;
    safeHtmlProps.iframeProps = {
      ...safeHtmlProps.iframeProps,
      ref: frame,
      onLoad: (event) => {
        originalLoad?.(event);
        postState();
      },
    };
  }

  return (
    <LegacyUIResourceRenderer
      {...props}
      resource={safeResource}
      htmlProps={safeHtmlProps}
      supportedContentTypes={['rawHtml']}
    />
  );
}
