// import { Button } from '@mui/base'
import { Box, TextField } from '@mui/material'
import { useState } from 'react'
import Button from '@mui/material/Button';

function StartPage({ setCurrentUsername, setCurrentChannel, handleChannelJoin }) {

  return (
    <Box component='form' onSubmit={handleChannelJoin} display="flex" flexDirection="column" alignItems="center" padding={1} >
      <TextField label="Username" variant="outlined" margin="normal" onChange={e => setCurrentUsername(e.target.value)}
      />
      <TextField label="Channel name" variant="outlined" margin="normal" onChange={e => setCurrentChannel(e.target.value)}
      />

      <Button
        variant="contained"
        color="primary"
        type="submit"
      > Join channel </Button>     
    </Box>
  )
}

export default StartPage