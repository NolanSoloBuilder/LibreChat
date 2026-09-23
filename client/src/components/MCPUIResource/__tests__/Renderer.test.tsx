import { render, screen } from '@testing-library/react';
import { UIResourceRenderer as LegacyUIResourceRenderer } from '@mcp-ui/client';
import type { UIResource } from 'librechat-data-provider';
import UIResourceRenderer from '../Renderer';

jest.mock('~/Providers', () => ({ useOptionalMessagesOperations: () => ({ getMessages: () => [] }) }));

jest.mock('@mcp-ui/client', () => ({
  UIResourceRenderer: jest.fn(({ resource }) => (
    <div data-testid="legacy-ui-resource" data-mime-type={resource.mimeType} />
  )),
}));

const mockLegacyRenderer = LegacyUIResourceRenderer as jest.MockedFunction<
  typeof LegacyUIResourceRenderer
>;

describe('UIResourceRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'application/vnd.mcp-ui.remote-dom+javascript',
    'application/vnd.mcp-ui.remote-dom',
    'text/uri-list',
  ])('blocks unsafe legacy MIME type %s', (mimeType) => {
    const resource: UIResource = {
      resourceId: 'unsafe-resource',
      uri: 'ui://unsafe',
      mimeType,
      text: "root.innerHTML='<img src=x onerror=alert(window.origin)>'",
    };

    const { container } = render(<UIResourceRenderer resource={resource} />);

    expect(container).toBeEmptyDOMElement();
    expect(mockLegacyRenderer).not.toHaveBeenCalled();
  });

  it('blocks malformed non-string MIME values', () => {
    const resource: UIResource = {
      resourceId: 'malformed-resource',
      uri: 'ui://malformed',
      mimeType: 1 as unknown as string,
      text: '<p>Malformed resource</p>',
    };

    const { container } = render(<UIResourceRenderer resource={resource} />);

    expect(container).toBeEmptyDOMElement();
    expect(mockLegacyRenderer).not.toHaveBeenCalled();
  });

  it('forces text/html through the raw HTML renderer without popup permissions', () => {
    const resource: UIResource = {
      resourceId: 'html-resource',
      uri: 'ui://html',
      mimeType: 'text/html',
      contentType: 'remoteDom',
      text: '<p>Safe iframe content</p>',
    };

    render(
      <UIResourceRenderer
        resource={resource}
        htmlProps={{ sandboxPermissions: 'allow-popups allow-same-origin' }}
      />,
    );

    expect(screen.getByTestId('legacy-ui-resource')).toBeInTheDocument();
    expect(mockLegacyRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.not.objectContaining({ contentType: expect.anything() }),
        htmlProps: {},
        supportedContentTypes: ['rawHtml'],
      }),
      expect.any(Object),
    );
  });

  it.each(['text/html; charset=utf-8', 'TEXT/HTML'])('normalizes HTML MIME type %s', (mimeType) => {
    const resource: UIResource = {
      resourceId: 'html-resource',
      uri: 'ui://html',
      mimeType,
      text: '<p>Safe iframe content</p>',
    };

    render(<UIResourceRenderer resource={resource} />);

    expect(mockLegacyRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.objectContaining({ mimeType: 'text/html' }),
        supportedContentTypes: ['rawHtml'],
      }),
      expect.any(Object),
    );
  });
});

it('bridges resolved theme on load and theme updates without replacing card HTML', () => {
  const React = require('react');
  const { ThemeContext } = require('@librechat/client');
  const { fireEvent } = require('@testing-library/react');
  mockLegacyRenderer.mockImplementation(({ htmlProps }: any) => (
    <iframe
      title="test-card"
      ref={htmlProps?.iframeProps?.ref}
      onLoad={htmlProps?.iframeProps?.onLoad}
    />
  ));
  const resource = {
    resourceId: 'theme',
    uri: 'ui://ashley-selection/test',
    mimeType: 'text/html',
    text: '<html><body>card</body></html>',
  };
  function Card({ mode }: { mode: string }) {
    const defaults = React.useContext(ThemeContext);
    return (
      <ThemeContext.Provider value={{ ...defaults, resolvedMode: mode }}>
        <UIResourceRenderer resource={resource} />
      </ThemeContext.Provider>
    );
  }
  const { rerender } = render(<Card mode="dark" />);
  const iframe = screen.getByTitle('test-card') as HTMLIFrameElement;
  const post = jest.spyOn(iframe.contentWindow!, 'postMessage');
  fireEvent.load(iframe);
  expect(post).toHaveBeenLastCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ theme: 'dark' }) }),
    '*',
  );
  const html = (mockLegacyRenderer.mock.calls.at(-1)?.[0].resource as UIResource).text;
  rerender(<Card mode="light" />);
  expect(post).toHaveBeenLastCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ theme: 'light' }) }),
    '*',
  );
  expect((mockLegacyRenderer.mock.calls.at(-1)?.[0].resource as UIResource).text).toBe(html);
});
