import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing, ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import {
  CoreBridge,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  useEditorContent,
} from '@10play/tentap-editor';

// TipTap's representation of an empty document; normalized to '' so clearing
// the editor stores an empty value, not markup.
const EMPTY_HTML = '<p></p>';

type RichEditorFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number;
};

function editorCss(colors: ThemeColors) {
  return `
    * { background-color: ${colors.card}; color: ${colors.text}; }
    blockquote { border-left: 3px solid ${colors.border}; padding-left: 1rem; }
    a { color: ${colors.primary}; }
  `;
}

export function RichEditorField({
  value,
  onChangeText,
  placeholder = 'Where you buy it, serving reminders, etc.',
  minHeight = 96,
}: RichEditorFieldProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Must stay referentially stable across renders: useEditorBridge only
  // recomputes its internal bridge when this array's identity changes, and a
  // new array here re-injects JS into the WebView, reloading the editor on
  // every keystroke (since typing re-renders this component via RHF).
  const bridgeExtensions = useMemo(
    () => [
      ...TenTapStartKit,
      CoreBridge.configureCSS(editorCss(colors)),
      PlaceholderBridge.configureExtension({ placeholder }),
    ],
    [colors, placeholder]
  );
  const theme = useMemo(() => ({ webview: { backgroundColor: colors.card } }), [colors]);

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    initialContent: value || EMPTY_HTML,
    bridgeExtensions,
    theme,
  });

  const content = useEditorContent(editor, { type: 'html', debounceInterval: 150 });
  const lastEmitted = useRef<string | null>(null);
  const initialValue = useRef(value);

  useEffect(() => {
    if (content == null) return;
    const normalized = content === EMPTY_HTML ? '' : content;
    if (normalized === value) return;
    lastEmitted.current = normalized;
    onChangeText(normalized);
  }, [content]);

  // The form value can arrive after mount (async fetch populating the form).
  // Push it into the editor as long as the user hasn't typed anything yet.
  useEffect(() => {
    if (lastEmitted.current == null && value !== initialValue.current) {
      editor.setContent(value || EMPTY_HTML);
    }
  }, [value]);

  return (
    <View style={[styles.field, { minHeight }]}>
      <RichText editor={editor} style={styles.editor} />
      <Toolbar editor={editor} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      overflow: 'hidden',
    },
    editor: {
      flex: 1,
      backgroundColor: colors.card,
    },
  });
}
