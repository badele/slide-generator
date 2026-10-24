'use client';

import dynamic from 'next/dynamic';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

// Dynamic import to avoid SSR issues with CodeMirror
const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

const editorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: '12px' },
  '.cm-content': { padding: '8px 0' },
});

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function YamlEditor({ value, onChange }: Props) {
  return (
    <div style={{ height: '100%' }} className="rounded-md overflow-hidden border border-gray-700">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[yaml(), editorTheme]}
        theme={oneDark}
        height="100%"
        style={{ height: '100%' }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}
