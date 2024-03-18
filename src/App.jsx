import { useState } from 'react'
import Channel from './components/Channel';
import StartPage from './components/StartPage';


function App() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentChannel, setCurrentChannel] = useState("");
  const [isHomePage, setIsHomePage] = useState(true);
  
  const handleChannelJoin = (event) => {
    event.preventDefault();
    setIsHomePage(false);
  };



  return (
    <>
      {isHomePage ? 
      <StartPage setCurrentUsername={setCurrentUsername} setCurrentChannel={setCurrentChannel} handleChannelJoin={handleChannelJoin} /> 
      : 
      <>
      <Channel  channel={currentChannel} username={currentUsername} />
      </>}


    </>
  )
}

export default App
