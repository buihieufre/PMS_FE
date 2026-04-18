
// Editor.js plugins are browser-only and will crash during SSR if imported at top level.
// This module provides a way to get the tools object only on the client side.

export const getEditorTools = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  // Use require for browser-only plugins to avoid top-level import execution on server
  const Header = require('@editorjs/header');
  const List = require('@editorjs/list');
  const Checklist = require('@editorjs/checklist');
  const Quote = require('@editorjs/quote');
  const Delimiter = require('@editorjs/delimiter');
  const Table = require('@editorjs/table');
  const Code = require('@editorjs/code');
  const InlineCode = require('@editorjs/inline-code');

  return {
    header: {
      class: Header,
      shortcut: 'CMD+SHIFT+H',
      config: {
        placeholder: 'Enter a header',
        levels: [1, 2, 3, 4],
        defaultLevel: 2
      }
    },
    list: {
      class: List,
      inlineToolbar: true,
      config: {
        defaultStyle: 'unordered'
      }
    },
    checklist: {
      class: Checklist,
      inlineToolbar: true,
    },
    quote: {
      class: Quote,
      inlineToolbar: true,
      shortcut: 'CMD+SHIFT+O',
      config: {
        quotePlaceholder: 'Enter a quote',
        captionPlaceholder: "Quote's author",
      },
    },
    table: {
      class: Table,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 3,
      },
    },
    code: Code,
    delimiter: Delimiter,
    inlineCode: {
      class: InlineCode,
      shortcut: 'CMD+SHIFT+M',
    }
  };
};
