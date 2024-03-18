 import { randomBytes, arr2hex, hex2bin, hex2arr, hash, arr2text, bin2hex } from 'uint8-util'

import clone from 'clone'
import Peer from 'simple-peer'
import Socket from 'simple-websocket'
import Socks from 'socks'
const socketPool = {}
const RECONNECT_MINIMUM = 10 * 1000
const RECONNECT_MAXIMUM = 60 * 60 * 1000
const RECONNECT_VARIANCE = 5 * 60 * 1000
const OFFER_TIMEOUT = 50 * 1000

 
 /**
  * WebRTC data channel limit beyond which data is split into chunks
  * Chose 16KB considering Chromium
  * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels#Concerns_with_large_messages
  */
 const MAX_MESSAGE_LENGTH = 16000

 class EventEmitter{
  constructor(){
      this.callbacks = {}
  }

  on(event, cb){
      if(!this.callbacks[event]) this.callbacks[event] = [];
      this.callbacks[event].push(cb)
  }

  emit(event, data){
      let cbs = this.callbacks[event]
      if(cbs){
          cbs.forEach(cb => cb(data))
      }
  }
}

 
 export default class P2PT extends EventEmitter {
   /**
    *
    * @param array announceURLs List of announce tracker URLs
    * @param string identifierString Identifier used to discover peers in the network
    */
   constructor (announceURLs = [], identifierString = '') {
     super()
 
     this.announceURLs = announceURLs
     this.trackers = {}
     this.peers = {}
     this.msgChunks = {}
     this.responseWaiting = {}
 
     if (identifierString) { this.setIdentifier(identifierString) }
 
     this._peerIdBuffer = randomBytes(20)
     this._peerId = arr2hex(this._peerIdBuffer)
     this._peerIdBinary = hex2bin(this._peerId)
    }
 
   /**
    * Set the identifier string used to discover peers in the network
    * @param string identifierString
    */
   async setIdentifier (identifierString) {
     this.identifierString = identifierString
     this.infoHash = hash(identifierString, 'hex')
     this._infoHashBuffer = hex2arr((await this.infoHash).toLowerCase())
     this._infoHashBinary = hex2bin((await this.infoHash).toLowerCase())
   }
 
   /**
    * Connect to network and start discovering peers
    */
   async start () {
     await this.infoHash
     this.on('peer', peer => {
       let newpeer = false
       if (!this.peers[peer.id]) {
         newpeer = true
         this.peers[peer.id] = {}
         this.responseWaiting[peer.id] = {}
       }
 
       peer.on('connect', () => {
         /**
          * Multiple data channels to one peer is possible
          * The `peer` object actually refers to a peer with a data channel. Even though it may have same `id` (peerID) property, the data channel will be different. Different trackers giving the same "peer" will give the `peer` object with different channels.
          * We will store all channels as backups in case any one of them fails
          * A peer is removed if all data channels become unavailable
          */
         this.peers[peer.id][peer.channelName] = peer
 
         if (newpeer) {
           this.emit('peerconnect', peer)
         }
       })
 
      //  peer.on('data', data => {
      //   //  console.log(`SIMPLE PEER DATA RECEIVED: ${data}`)
      //   //  peer.send("asdasd" + peer.id)
      //    this.emit('data', peer, data)
        
      //    if (ArrayBuffer.isView(data)) data = arr2text(data)
 
      //    console.log(`got a message from  + ${peer.id}: ${data}`)
      //   // console.log(`data: ${data}`)
      //    if (data[0] === JSON_MESSAGE_IDENTIFIER) {
      //      try {
      //          const jsonData = JSON.parse(data.slice(1))
      //          console.log(`JSON DATA: ${JSON.stringify(jsonData)}`)
      //       //  data = JSON.parse(data.slice(1))
 
      //        // A respond function
      //        console.log (`PEER RESPOND: ${peer.send}, type: ${typeof peer} `)

      //        peer.respond = this._peerRespond(peer, jsonData.id)
            
      //        console.log("chunkHandler")
      //        let msg = this._chunkHandler(jsonData)
      //       console.log(`msg after chunkHandler: ${msg}`)
      //        // msg fully retrieved
      //        if (msg !== false) {
      //          if (jsonData.o) {
      //           //    console.log("parsing msg")
      //            msg = JSON.parse(msg)
      //           //  console.log(`msg after parse: ${JSON.stringify(msg)}`)

      //          }
 
      //          /**
      //           * If there's someone waiting for a response, call them
      //           */
      //          if (this.responseWaiting[peer.id][jsonData.id]) {
      //           //    console.log("responseWaiting")
      //            this.responseWaiting[peer.id][jsonData.id]([peer, msg])
      //            delete this.responseWaiting[peer.id][jsonData.id]
      //          } else {
      //           //    console.log(`emitting msg to peer ${peer.id}, msg: ${JSON.stringify(msg)}`)
      //            this.emit('msg', peer, msg)
      //          }
      //       //    console.log("destroying chunks")
      //          this._destroyChunks(jsonData.id)
      //        }
      //      } catch (e) {
      //          console.log("ERROR HERE")
      //        console.log(e)
      //      }
      //    }
      //  })
 
       peer.on('error', err => {
         this._removePeer(peer)
         console.log('Error in connection : ' + err)
       })
 
       peer.on('close', () => {
         this._removePeer(peer)
         console.log('Connection closed with ' + peer.id)
       })
     })
 
     // Tracker responded to the announce request
     this.on('update', response => {
       const tracker = this.trackers[this.announceURLs.indexOf(response.announce)]
 
       this.emit(
         'trackerconnect',
         tracker,
         this.getTrackerStats()
       )
     })
 
     // Errors in tracker connection
     this.on('warning', err => {
       this.emit(
         'trackerwarning',
         err,
         this.getTrackerStats()
       )
     })
 
     this._fetchPeers()
   }
 
   /**
    * Add a tracker
    * @param string announceURL Tracker Announce URL
    */
   addTracker (announceURL) {
     if (this.announceURLs.indexOf(announceURL) !== -1) {
       throw new Error('Tracker already added')
     }
 
     const key = this.announceURLs.push(announceURL)
 
     this.trackers[key] = new WebSocketTracker(this, announceURL)
     this.trackers[key].announce(this._defaultAnnounceOpts())
   }
 
   /**
    * Remove a tracker without destroying peers
    */
   removeTracker (announceURL) {
     const key = this.announceURLs.indexOf(announceURL)
 
     if (key === -1) {
       throw new Error('Tracker does not exist')
     }
 
     // hack to not destroy peers
     this.trackers[key].peers = []
     this.trackers[key].destroy()
 
     delete this.trackers[key]
     delete this.announceURLs[key]
   }
 
   /**
    * Remove a peer from the list if all channels are closed
    * @param integer id Peer ID
    */
   _removePeer (peer) {
     if (!this.peers[peer.id]) { return false }
 
     delete this.peers[peer.id][peer.channelName]
 
     // All data channels are gone. Peer lost
     if (Object.keys(this.peers[peer.id]).length === 0) {
       this.emit('peerclose', peer)
 
       delete this.responseWaiting[peer.id]
       delete this.peers[peer.id]
     }
   }
 
   /**
    * Send a msg and get response for it
    * @param Peer peer simple-peer object to send msg to
    * @param string msg Message to send
    * @param integer msgID ID of message if it's a response to a previous message
    */
   send (peer, msg, msgID = '') {
     return new Promise((resolve, reject) => {
       const data = {
         id: msgID !== '' ? msgID : Math.floor(Math.random() * 100000 + 100000),
         msg
       }
 
       if (typeof msg === 'object') {
         data.msg = JSON.stringify(msg)
         data.o = 1 // indicating object
       }
 
       try {
         /**
          * Maybe peer channel is closed, so use a different channel if available
          * Array should atleast have one channel, otherwise peer connection is closed
          */
         if (!peer.connected) {
           for (const index in this.peers[peer.id]) {
             peer = this.peers[peer.id][index]
 
             if (peer.connected) break
           }
         }
 
         if (!this.responseWaiting[peer.id]) {
           this.responseWaiting[peer.id] = {}
         }
         this.responseWaiting[peer.id][data.id] = resolve
       } catch (e) {
         return reject(Error('Connection to peer closed' + e))
       }
 
       let chunks = 0
       let remaining = ''
       while (data.msg.length > 0) {
         data.c = chunks
 
         remaining = data.msg.slice(MAX_MESSAGE_LENGTH)
         data.msg = data.msg.slice(0, MAX_MESSAGE_LENGTH)
 
         if (!remaining) { data.last = true }
         console.log(`SENDING TO PEER: ${JSON.stringify(data)}`);
         peer.send(JSON_MESSAGE_IDENTIFIER + JSON.stringify(data))
        //  peer.send("abcdef")
 
         data.msg = remaining
         chunks++
       }
 
       console.log(`sent a message to ${peer.id}, chunks: ${chunks}`)
     })
   }
 
   /**
    * Request more peers
    */
   requestMorePeers () {
     return new Promise(resolve => {
       for (const key in this.trackers) {
         this.trackers[key].announce(this._defaultAnnounceOpts())
       }
       resolve(this.peers)
     })
   }
 
   /**
    * Get basic stats about tracker connections
    */
   getTrackerStats () {
     let connectedCount = 0
     for (const key in this.trackers) {
       if (this.trackers[key].socket && this.trackers[key].socket.connected) {
         connectedCount++
       }
     }
 
     return {
       connected: connectedCount,
       total: this.announceURLs.length
     }
   }
 
   /**
    * Destroy object
    */
   destroy () {
     let key
     for (key in this.peers) {
       for (const key2 in this.peers[key]) {
         this.peers[key][key2].destroy()
       }
     }
     for (key in this.trackers) {
       this.trackers[key].destroy()
     }
   }
 
   /**
    * A custom function binded on Peer object to easily respond back to message
    * @param Peer peer Peer to send msg to
    * @param integer msgID Message ID
    */
   _peerRespond (peer, msgID) {
     return msg => {
       return this.send(peer, msg, msgID)
     }
   }
 
   /**
    * Handle msg chunks. Returns false until the last chunk is received. Finally returns the entire msg
    * @param object data
    */
   _chunkHandler (data) {
     if (!this.msgChunks[data.id]) {
       this.msgChunks[data.id] = []
     }
 
     this.msgChunks[data.id][data.c] = data.msg
 
     if (data.last) {
       const completeMsg = this.msgChunks[data.id].join('')
       return completeMsg
     } else {
       return false
     }
   }
 
   /**
    * Remove all stored chunks of a particular message
    * @param integer msgID Message ID
    */
   _destroyChunks (msgID) {
     delete this.msgChunks[msgID]
   }
 
   /**
    * Default announce options
    * @param object opts Options
    */
   _defaultAnnounceOpts (opts = {}) {
     if (opts.numwant == null) opts.numwant = 50
 
     if (opts.uploaded == null) opts.uploaded = 0
     if (opts.downloaded == null) opts.downloaded = 0
 
     return opts
   }
 
   /**
    * Initialize trackers and fetch peers
    */
   _fetchPeers () {
     for (const key in this.announceURLs) {
       this.trackers[key] = new WebSocketTracker(this, this.announceURLs[key])
       this.trackers[key].announce(this._defaultAnnounceOpts())
     }
   }
 }

 class Tracker extends EventEmitter {
    constructor (client, announceUrl) {
      super()
  
      this.client = client
      this.announceUrl = announceUrl
  
      this.interval = null
      this.destroyed = false
    }
  
    setInterval (intervalMs) {
      if (intervalMs == null) intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL
  
      clearInterval(this.interval)
  
      if (intervalMs) {
        this.interval = setInterval(() => {
          this.announce(this.client._defaultAnnounceOpts())
        }, intervalMs)
        if (this.interval.unref) this.interval.unref()
      }
    }
  }

  class WebSocketTracker extends Tracker {
    constructor (client, announceUrl) {
      super(client, announceUrl)
      console.log('new websocket tracker %s', announceUrl)
  
      this.peers = {} // peers (offer id -> peer)
      this.socket = null
  
      this.reconnecting = false
      this.retries = 0
      this.reconnectTimer = null
  
      // Simple boolean flag to track whether the socket has received data from
      // the websocket server since the last time socket.send() was called.
      this.expectingResponse = false
  
      this._openSocket()
    }
  
    announce (opts) {
      if (this.destroyed || this.reconnecting) return
      if (!this.socket.connected) {
        this.socket.once('connect', () => {
          this.announce(opts)
        })
        return
      }
  
      const params = Object.assign({}, opts, {
        action: 'announce',
        info_hash: this.client._infoHashBinary,
        peer_id: this.client._peerIdBinary
      })
      if (this._trackerId) params.trackerid = this._trackerId
  
      if (opts.event === 'stopped' || opts.event === 'completed') {
        // Don't include offers with 'stopped' or 'completed' event
        this._send(params)
      } else {
        // Limit the number of offers that are generated, since it can be slow
        const numwant = Math.min(opts.numwant, 5)
  
        this._generateOffers(numwant, offers => {
          params.numwant = numwant
          params.offers = offers
          this._send(params)
        })
      }
    }
  
    scrape (opts) {
      if (this.destroyed || this.reconnecting) return
      if (!this.socket.connected) {
        this.socket.once('connect', () => {
          this.scrape(opts)
        })
        return
      }
  
      const infoHashes = (Array.isArray(opts.infoHash) && opts.infoHash.length > 0)
        ? opts.infoHash.map(infoHash => hex2bin(infoHash))
        : (opts.infoHash && hex2bin(opts.infoHash)) || this.client._infoHashBinary
      const params = {
        action: 'scrape',
        info_hash: infoHashes
      }
  
      this._send(params)
    }
  
    destroy (cb = noop) {
      if (this.destroyed) return cb(null)
  
      this.destroyed = true
  
      clearInterval(this.interval)
      clearTimeout(this.reconnectTimer)
  
      // Destroy peers
      for (const peerId in this.peers) {
        const peer = this.peers[peerId]
        clearTimeout(peer.trackerTimeout)
        peer.destroy()
      }
      this.peers = null
  
      if (this.socket) {
        this.socket.removeListener('connect', this._onSocketConnectBound)
        this.socket.removeListener('data', this._onSocketDataBound)
        this.socket.removeListener('close', this._onSocketCloseBound)
        this.socket.removeListener('error', this._onSocketErrorBound)
        this.socket = null
      }
  
      this._onSocketConnectBound = null
      this._onSocketErrorBound = null
      this._onSocketDataBound = null
      this._onSocketCloseBound = null
  
      if (socketPool[this.announceUrl]) {
        socketPool[this.announceUrl].consumers -= 1
      }
  
      // Other instances are using the socket, so there's nothing left to do here
      if (socketPool[this.announceUrl].consumers > 0) return cb()
  
      let socket = socketPool[this.announceUrl]
      delete socketPool[this.announceUrl]
      socket.on('error', noop) // ignore all future errors
      socket.once('close', cb)
  
      let timeout
  
      // If there is no data response expected, destroy immediately.
      if (!this.expectingResponse) return destroyCleanup()
  
      // Otherwise, wait a short time for potential responses to come in from the
      // server, then force close the socket.
      timeout = setTimeout(destroyCleanup, 1000)
  
      // But, if a response comes from the server before the timeout fires, do cleanup
      // right away.
      socket.once('data', destroyCleanup)
  
      function destroyCleanup () {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        socket.removeListener('data', destroyCleanup)
        socket.destroy()
        socket = null
      }
    }
  
    _openSocket () {
      this.destroyed = false
  
      if (!this.peers) this.peers = {}
  
      this._onSocketConnectBound = () => {
        this._onSocketConnect()
      }
      this._onSocketErrorBound = err => {
        this._onSocketError(err)
      }
      this._onSocketDataBound = data => {
        this._onSocketData(data)
      }
      this._onSocketCloseBound = () => {
        this._onSocketClose()
      }
  
      this.socket = socketPool[this.announceUrl]
      if (this.socket) {
        socketPool[this.announceUrl].consumers += 1
        if (this.socket.connected) {
          this._onSocketConnectBound()
        }
      } else {
        const parsedUrl = new URL(this.announceUrl)
        let agent
        if (this.client._proxyOpts) {
          agent = parsedUrl.protocol === 'wss:' ? this.client._proxyOpts.httpsAgent : this.client._proxyOpts.httpAgent
          if (!agent && this.client._proxyOpts.socksProxy) {
            agent = new Socks.Agent(clone(this.client._proxyOpts.socksProxy), (parsedUrl.protocol === 'wss:'))
          }
        }
        this.socket = socketPool[this.announceUrl] = new Socket({ url: this.announceUrl, agent })
        this.socket.consumers = 1
        this.socket.once('connect', this._onSocketConnectBound)
      }
  
      this.socket.on('data', this._onSocketDataBound)
      this.socket.once('close', this._onSocketCloseBound)
      this.socket.once('error', this._onSocketErrorBound)
    }
  
    _onSocketConnect () {
      if (this.destroyed) return
  
      if (this.reconnecting) {
        this.reconnecting = false
        this.retries = 0
        this.announce(this.client._defaultAnnounceOpts())
      }
    }
  
    _onSocketData (data) {
      if (this.destroyed) return
  
      this.expectingResponse = false
  
      try {
        data = JSON.parse(arr2text(data))
      } catch (err) {
        this.client.emit('warning', new Error('Invalid tracker response'))
        return
      }
  
      if (data.action === 'announce') {
        this._onAnnounceResponse(data)
      } else if (data.action === 'scrape') {
        this._onScrapeResponse(data)
      } else {
        this._onSocketError(new Error(`invalid action in WS response: ${data.action}`))
      }
    }
  
    _onAnnounceResponse (data) {
      if (data.info_hash !== this.client._infoHashBinary) {
        console.log(
          'ignoring websocket data from %s for %s (looking for %s: reused socket)',
          this.announceUrl, bin2hex(data.info_hash), this.client.infoHash
        )
        return
      }
  
      if (data.peer_id && data.peer_id === this.client._peerIdBinary) {
        // ignore offers/answers from this client
        return
      }
  
      console.log(
        'received %s from %s for %s',
        JSON.stringify(data), this.announceUrl, this.client.infoHash
      )
  
      const failure = data['failure reason']
      if (failure) return this.client.emit('warning', new Error(failure))
  
      const warning = data['warning message']
      if (warning) this.client.emit('warning', new Error(warning))
  
      const interval = data.interval || data['min interval']
      if (interval) this.setInterval(interval * 1000)
  
      const trackerId = data['tracker id']
      if (trackerId) {
        // If absent, do not discard previous trackerId value
        this._trackerId = trackerId
      }
  
      if (data.complete != null) {
        const response = Object.assign({}, data, {
          announce: this.announceUrl,
          infoHash: bin2hex(data.info_hash)
        })
        this.client.emit('update', response)
      }
  
      let peer
      if (data.offer && data.peer_id) {
        console.log('creating peer (from remote offer)')
        peer = this._createPeer()
        peer.id = bin2hex(data.peer_id)
        peer.once('signal', answer => {
          const params = {
            action: 'announce',
            info_hash: this.client._infoHashBinary,
            peer_id: this.client._peerIdBinary,
            to_peer_id: data.peer_id,
            answer,
            offer_id: data.offer_id
          }
          if (this._trackerId) params.trackerid = this._trackerId
          this._send(params)
        })
        this.client.emit('peer', peer)
        peer.signal(data.offer)
      }
  
      if (data.answer && data.peer_id) {
        const offerId = bin2hex(data.offer_id)
        peer = this.peers[offerId]
        if (peer) {
          peer.id = bin2hex(data.peer_id)
          this.client.emit('peer', peer)
          peer.signal(data.answer)
  
          clearTimeout(peer.trackerTimeout)
          peer.trackerTimeout = null
          delete this.peers[offerId]
        } else {
          console.log(`got unexpected answer: ${JSON.stringify(data.answer)}`)
        }
      }
    }
  
    _onScrapeResponse (data) {
      data = data.files || {}
  
      const keys = Object.keys(data)
      if (keys.length === 0) {
        this.client.emit('warning', new Error('invalid scrape response'))
        return
      }
  
      keys.forEach(infoHash => {
        // TODO: optionally handle data.flags.min_request_interval
        // (separate from announce interval)
        const response = Object.assign(data[infoHash], {
          announce: this.announceUrl,
          infoHash: bin2hex(infoHash)
        })
        this.client.emit('scrape', response)
      })
    }
  
    _onSocketClose () {
      if (this.destroyed) return
      this.destroy()
      this._startReconnectTimer()
    }
  
    _onSocketError (err) {
      if (this.destroyed) return
      this.destroy()
      // errors will often happen if a tracker is offline, so don't treat it as fatal
      this.client.emit('warning', err)
      this._startReconnectTimer()
    }
  
    _startReconnectTimer () {
      const ms = Math.floor(Math.random() * RECONNECT_VARIANCE) + Math.min(Math.pow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM)
  
      this.reconnecting = true
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = setTimeout(() => {
        this.retries++
        this._openSocket()
      }, ms)
      if (this.reconnectTimer.unref) this.reconnectTimer.unref()
  
      console.log('reconnecting socket in %s ms', ms)
    }
  
    _send (params) {
      if (this.destroyed) return
      this.expectingResponse = true
      const message = JSON.stringify(params)
      console.log('send %s', message)
      this.socket.send(message)
    }
  
    _generateOffers (numwant, cb) {
      const self = this
      const offers = []
      console.log('generating %s offers', numwant)
  
      for (let i = 0; i < numwant; ++i) {
        generateOffer()
      }
      checkDone()
  
      function generateOffer () {
        const offerId = arr2hex(randomBytes(20))
        console.log('creating peer (from _generateOffers)')
        const peer = self.peers[offerId] = self._createPeer({ initiator: true })
        peer.once('signal', offer => {
          offers.push({
            offer,
            offer_id: hex2bin(offerId)
          })
          checkDone()
        })
        peer.trackerTimeout = setTimeout(() => {
          console.log('tracker timeout: destroying peer')
          peer.trackerTimeout = null
          delete self.peers[offerId]
          peer.destroy()
        }, OFFER_TIMEOUT)
        if (peer.trackerTimeout.unref) peer.trackerTimeout.unref()
      }
  
      function checkDone () {
        if (offers.length === numwant) {
          console.log('generated %s offers', numwant)
          cb(offers)
        }
      }
    }
  
    _createPeer (opts) {
      const self = this
  
      opts = Object.assign({
        trickle: false,
        config: self.client._rtcConfig,
        wrtc: self.client._wrtc
      }, opts)
  
      const peer = new Peer(opts)
  
      peer.once('error', onError)
      peer.once('connect', onConnect)
  
      return peer
  
      // Handle peer 'error' events that are fired *before* the peer is emitted in
      // a 'peer' event.
      function onError (err) {
        self.client.emit('warning', new Error(`Connection error: ${err.message}`))
        peer.destroy()
      }
  
      // Once the peer is emitted in a 'peer' event, then it's the consumer's
      // responsibility to listen for errors, so the listeners are removed here.
      function onConnect () {
        peer.removeListener('error', onError)
        peer.removeListener('connect', onConnect)
      }
    }
  }
  
  WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 1000 // 30 seconds
  // Normally this shouldn't be accessed but is occasionally useful
  WebSocketTracker._socketPool = socketPool
  
  function noop () {}