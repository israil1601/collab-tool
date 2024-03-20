import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'

import { ySyncPlugin, yCursorPlugin, yUndoPlugin, undo, redo } from 'y-prosemirror'
import { EditorState } from 'prosemirror-state'
import { schema } from '../utils/prosemirror-schema'
import { EditorView } from 'prosemirror-view'
import { exampleSetup } from 'prosemirror-example-setup'
import { keymap } from 'prosemirror-keymap'
import { P2ptProvider } from '../utils/yjs-provider'
import { Container, Divider, FormControl, Grid, IconButton, List, ListItem, ListItemText, Paper, TextField, Typography } from "@mui/material";
import Chat from './Chat'
import Box from '@mui/material/Box';
import SideBar from './SideBar'
import FileView from './FileView'
import UserList from './UserList'


function Channel({ channel, username, provider, ydoc }) {
    const [ currentTab, setCurrentTab ] = useState('Files')
    provider.awareness.setLocalStateField('user', { name: username })
    const type = ydoc.getXmlFragment('prosemirror')
    // const usernames = provider.getPeerUsernames()
    // console.log(`Peers: ${usernames}`)

    // useEffect(() => {

    //     const editor = documentRef.current

    //     const prosemirrorView = new EditorView(editor, {
    //         state: EditorState.create({
    //             schema,
    //             plugins: [
    //                 ySyncPlugin(type),
    //                 yCursorPlugin(provider.awareness),
    //                 yUndoPlugin(),
    //                 keymap({
    //                     'Mod-z': undo,
    //                     'Mod-y': redo,
    //                     'Mod-Shift-z': redo
    //                 })
    //             ].concat(exampleSetup({ schema }))
    //         })
    //     })
    // }, [])

    const handlePing = peerName => {
        provider.sendPeerPing(peerName)
    }

    const getCurrentElement = () => {
        if (currentTab === 'Files') {
            return <FileView type={type} provider={provider} />
        }
        if (currentTab === 'Chat') {
            return <Chat provider={provider} />
        }
        if (currentTab === 'Peers') {
            return <UserList provider={provider} handlePing={handlePing} />
        }
    }
    console.log("current tab: " + currentTab)

    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <SideBar onTabSelect={setCurrentTab} />
                <Box
                    component="main"
                    sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
                >
                    {/* <div ref={documentRef}></div> */}
                    {getCurrentElement()}
                </Box>
            </Box>

            {/* <Grid container spacing={2} columns={16}>
                <Grid item xs={8}>
                    <div ref={documentRef}></div>
                </Grid>
                <Grid item xs={4}>
                    <Chat provider={provider}  />
                </Grid>
            </Grid> */}
        </>
    )
}

export default Channel