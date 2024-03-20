import { useEffect, useRef, useState } from 'react'
import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror'
import { EditorState } from 'prosemirror-state'
import { schema } from '../utils/prosemirror-schema'
import { EditorView } from 'prosemirror-view'
import { exampleSetup } from 'prosemirror-example-setup'
import { keymap } from 'prosemirror-keymap'

export default function FileView( { type, provider } ) {
    const documentRef = useRef(null);
    useEffect(() => {

        const editor = documentRef.current

        const prosemirrorView = new EditorView(editor, {
            state: EditorState.create({
                schema,
                plugins: [
                    ySyncPlugin(type),
                    yCursorPlugin(provider.awareness),
                    yUndoPlugin(),
                    keymap({
                        'Mod-z': undo,
                        'Mod-y': redo,
                        'Mod-Shift-z': redo
                    })
                ].concat(exampleSetup({ schema }))
            })
        })
    }, [])

  return (
      <>
        <div ref={documentRef}></div>
    </>
  );
}
