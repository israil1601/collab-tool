import { Container, Divider, FormControl, Grid, IconButton, List, ListItem, ListItemText, Paper, TextField, Typography } from "@mui/material";
import { Box } from "@mui/system";
import { useEffect, useRef, useState } from "react";
import SendIcon from '@mui/icons-material/Send';

export default function Chat({ provider }) {

    const [chatMessages, setChatMessages] = useState([]);
    const [message, setMessage] = useState('');
    const chatMessageHandler = ({from, message}) => {
        console.log(`message handler received ${message}`)
        setChatMessages([...chatMessages, {
            from,
            message
        }]);
    }
    provider.setChatMessageHandler(chatMessageHandler)

    // useEffect(() => {
        // provider.on("chat", (messageObject) => {
        //     console.log(`received chat: ${messageObject}, type: ${typeof messageObject}`)
        //     // setChatMessages([...chatMessages, {
        //     //     from,
        //     //     message
        //     // }]);
        // })
    // }, [chatMessages]);


    const handleMessageChange = (event) => {
        setMessage(event.target.value);
    }

    const handleEnterKey = (event) => {
        if (event.keyCode === 13) {
            sendMessage();
        }
    }

    const sendMessage = () => {
        if (provider.username && message) {
            console.log('Send!');
            provider.sendChatMessage(message);
            setMessage('');
            setChatMessages([...chatMessages, { from: provider.username, message }])
        }
    };

    const listChatMessages = chatMessages.map((messageObject, index) =>
        <ListItem key={index}>
            <ListItemText primary={`${messageObject.from}: ${messageObject.message}`} />
        </ListItem>
    );

    return (
        <>
            <Container>
                <Paper elevation={5}>
                    <Box p={3}>
                        <Typography variant="h4" gutterBottom>
                            Chat for channel {provider.roomname}
                        </Typography>
                        <Divider />
                        <Grid container spacing={4} alignItems="center">
                            <Grid id="chat-window" xs={12} item>
                                <List id="chat-window-messages">
                                    {listChatMessages}
                                </List>
                            </Grid>
                            <Grid xs={9} item>
                                <FormControl fullWidth>
                                    <TextField onChange={handleMessageChange} onKeyDown={handleEnterKey}
                                        value={message}
                                        label="Type your message..."
                                        variant="outlined" />
                                </FormControl>
                            </Grid>
                            <Grid xs={1} item>
                                <IconButton onClick={sendMessage}
                                    aria-label="send"
                                    color="primary">
                                    <SendIcon />
                                </IconButton>
                            </Grid>

                        </Grid>
                    </Box>
                </Paper>
            </Container>
        </>
    );
}