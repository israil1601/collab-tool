import * as React from 'react';
import { styled } from '@mui/material/styles';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LeakAddIcon from '@mui/icons-material/LeakAdd';
import SensorsIcon from '@mui/icons-material/Sensors';
import PersonIcon from '@mui/icons-material/Person';

const Demo = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
}));

export default function UserList( { provider, handlePing } ) {
  const onUserListChange = () => setCurrentUsers(provider.getPeerUsernames())
  provider.setUserChangeListener(onUserListChange);
  const [ currentUsers, setCurrentUsers ] = React.useState(provider.getPeerUsernames());
  console.log(`Current peers: ${currentUsers}`)


  return (
      <>
     {/* <Box sx={{ flexGrow: 1, maxWidth: 752 }}> */}
        <Typography sx={{ mt: 4, mb: 2 }} variant="h6" component="div">
            List of connected peers
          </Typography>
          <Demo>
            <List>
              {currentUsers.map((username) =>
                <ListItem
                  secondaryAction={
                    <IconButton edge="end" aria-label="ping" onClick={() => handlePing(username)}>
                      <SensorsIcon />
                    </IconButton>
                  }
                  key={username}
                >
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={username}
                    secondary={provider.getPeerPing(username)}
                  />
                </ListItem>,
              )}
            </List>
          </Demo>
     {/* </Box> */}
    </>
  );
}
