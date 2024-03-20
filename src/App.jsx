import { useState } from 'react'
import Bar from './components/Bar';
import Channel from './components/Channel';
import StartPage from './components/StartPage';
import * as Y from 'yjs'
import { P2ptProvider } from './utils/yjs-provider'


function App() {
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentChannel, setCurrentChannel] = useState("");
  const [isHomePage, setIsHomePage] = useState(true);
  const ydoc = new Y.Doc();
  
  const handleChannelJoin = (event) => {
    event.preventDefault();
    setIsHomePage(false);
  };



  return (
    <>
    <Bar setIsHomePage={setIsHomePage}/>
      {isHomePage ? 
      <StartPage setCurrentUsername={setCurrentUsername} setCurrentChannel={setCurrentChannel} handleChannelJoin={handleChannelJoin} /> 
      : 
      <>
      <Channel  channel={currentChannel} username={currentUsername} provider={new P2ptProvider(currentChannel, ydoc, currentUsername)} ydoc={ydoc} />
      </>}


    </>
  )
}

export default App
