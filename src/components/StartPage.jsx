import { useState } from 'react'

function StartPage({setCurrentUsername, setCurrentChannel, handleChannelJoin}) {
  
  return (
    <form onSubmit={handleChannelJoin}>
      <label> Username: 
      <input type="text" name="usernameInput" id="usernameInput" onChange={e => setCurrentUsername(e.target.value)}  />
      </label>
      <label> Channel name: 
      <input type="text" name="channelInput" id="channelInput" onChange={e => setCurrentChannel(e.target.value)}  />
      </label>
      <input type="submit" value="Join channel" />
    </form>
  )
}

export default StartPage