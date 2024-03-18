import { useEffect, useRef } from 'react'
import * as Y from 'yjs'

import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror'
import { EditorState } from 'prosemirror-state'
import { schema } from '../utils/prosemirror-schema'
import { EditorView } from 'prosemirror-view'
import { exampleSetup } from 'prosemirror-example-setup'
import { keymap } from 'prosemirror-keymap'
import { P2ptProvider } from '../utils/yjs-provider'

function Channel({ channel, username }) {
    const documentRef = useRef(null);
    const ydoc = new Y.Doc()
    const provider = new P2ptProvider(channel, ydoc)
    provider.awareness.setLocalStateField('user', { name: username })
    const type = ydoc.getXmlFragment('prosemirror')

    useEffect(() => {
        console.log(documentRef.current)

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

    return <div ref={documentRef}></div>
}

export default Channel