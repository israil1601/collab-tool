import { AppBar, Toolbar, Typography , Box} from "@mui/material";
import HomeIcon from '@mui/icons-material/Home';
import IconButton from '@mui/material/IconButton';

export default function Bar({ setIsHomePage }) {
    return (
        <>
            <Box mb={4}>
                <AppBar position="relative"  sx={{ zIndex: 101 }}>
                    <Toolbar>
                        <IconButton mr={2} size="large" onClick={() => setIsHomePage(true)}>
                            <HomeIcon fontSize={'large'} />
                        </IconButton>
                        <Typography variant="h6">
                            Collaboration tool
                        </Typography>
                    </Toolbar>
                </AppBar>
            </Box>
        </>
    )
}