import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { CoreBridge, RichText, TenTapStartKit, useEditorBridge } from '@10play/tentap-editor';

type RichTextViewProps = {
  html: string;
  style?: StyleProp<ViewStyle>;
};

function viewerCss(colors: ThemeColors) {
  return `
    * { background-color: ${colors.card}; color: ${colors.text}; }
    body { margin: 0; }
    blockquote { border-left: 3px solid ${colors.border}; padding-left: 1rem; }
    a { color: ${colors.primary}; }
  `;
}

/** Read-only renderer for stored rich-text HTML (meal steps, product notes).
 * Uses the same TipTap engine as RichEditorField so saved content renders
 * exactly as it was authored. */
export function RichTextView({ html, style }: RichTextViewProps) {
  const colors = useThemeColor();

  const editor = useEditorBridge({
    editable: false,
    dynamicHeight: true,
    initialContent: html,
    bridgeExtensions: [...TenTapStartKit, CoreBridge.configureCSS(viewerCss(colors))],
    theme: { webview: { backgroundColor: colors.card } },
  });

  const lastHtml = useRef(html);
  useEffect(() => {
    if (html !== lastHtml.current) {
      lastHtml.current = html;
      editor.setContent(html);
    }
  }, [html]);

  return <RichText editor={editor} style={[{ backgroundColor: colors.card }, style]} scrollEnabled={false} />;
}
