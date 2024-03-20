// import P2PT from "p2pt";
import P2PT from './p2pt'
import * as time from 'lib0/time'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as syncProtocol from 'y-protocols/sync'
import * as authProtocol from 'y-protocols/auth'
import * as awarenessProtocol from 'y-protocols/awareness'
import { ObservableV2 } from 'lib0/observable'

import * as env from 'lib0/environment'


const IDENTIFIER = "elec-e7320-collab-tool-project"
const trackersAnnounceURLs = [
    "wss://tracker.webtorrent.dev",
    // "wss://tracker.files.fm:7073/announce",
    // "ws://tracker.files.fm:7072/announce",
    
    // "wss://tracker.openwebtorrent.com",
    // "wss://tracker.sloppyta.co:443/",
    // "wss://tracker.novage.com.ua:443/",
    // "wss://tracker.btorrent.xyz:443/",
]
const messageSync = 0
const messageQueryAwareness = 3
const messageAwareness = 1
const messageAuth = 2

/**
 *                       encoder,          decoder,          provider,          emitSynced, messageType
 * @type {Array<function(encoding.Encoder, decoding.Decoder, WebsocketProvider, boolean,    number):void>}
 */
const messageHandlers = []

messageHandlers[messageSync] = (
    encoder,
    decoder,
    provider,
    emitSynced,
    _messageType
) => {
    encoding.writeVarUint(encoder, messageSync)
    const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        provider.doc,
        provider
    )
    if (
        emitSynced && syncMessageType === syncProtocol.messageYjsSyncStep2 &&
        !provider.synced
    ) {
        provider.synced = true
    }
}

messageHandlers[messageQueryAwareness] = (
    encoder,
    _decoder,
    provider,
    _emitSynced,
    _messageType
) => {
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
            provider.awareness,
            Array.from(provider.awareness.getStates().keys())
        )
    )
}

messageHandlers[messageAwareness] = (
    _encoder,
    decoder,
    provider,
    _emitSynced,
    _messageType
) => {
    awarenessProtocol.applyAwarenessUpdate(
        provider.awareness,
        decoding.readVarUint8Array(decoder),
        provider
    )
}

messageHandlers[messageAuth] = (
    _encoder,
    decoder,
    provider,
    _emitSynced,
    _messageType
) => {
    authProtocol.readAuthMessage(
        decoder,
        provider.doc,
        (_ydoc, reason) => permissionDeniedHandler(reason)
    )
}

// @todo - this should depend on awareness.outdatedTime
const messageReconnectTimeout = 30000

/**
 * @param {WebsocketProvider} provider
 * @param {string} reason
 */
const permissionDeniedHandler = (reason) =>
    console.warn(`Permission denied to access the document.\n${reason}`)

/**
 * @param {WebsocketProvider} provider
 * @param {Uint8Array} buf
 * @param {boolean} emitSynced
 * @return {encoding.Encoder}
 */
const readMessage = (provider, buf, emitSynced) => {
    const decoder = decoding.createDecoder(buf)
    const encoder = encoding.createEncoder()
    const messageType = decoding.readVarUint(decoder)
    const messageHandler = provider.messageHandlers[messageType]
    if (/** @type {any} */ (messageHandler)) {
        messageHandler(encoder, decoder, provider, emitSynced, messageType)
    } else {
        console.error('Unable to compute message: ')
    }
    return encoder
}


/**
 * @param {WebsocketProvider} provider
 */
const setupPeerConnection = (provider) => {
    if (provider.shouldConnect && provider.p2pt !== null) {
        provider.connecting = true;
        provider.connected = false;
        provider.synced = false;
        provider.p2pt.on("trackerwarning", (error, stats) => {
            provider.emit('connection-error', [error, provider])
        })

        provider.p2pt.on("peerclose", (peer) => {
            provider.remotePeers = provider.remotePeers.filter(remotePeer => peer.id != remotePeer.peer.id);
            if (provider.userChangeListener) {
                provider.userChangeListener();
            }
            const isLastPeer = provider.remotePeers.length === 0;
            if (isLastPeer) {
                provider.emit('connection-close', ["connection-close", provider])
                provider.connecting = false
                provider.connected = false
                provider.synced = false
                // update awareness (all users except local left)
                awarenessProtocol.removeAwarenessStates(
                    provider.awareness,
                    Array.from(provider.awareness.getStates().keys()).filter((client) =>
                        client !== provider.doc.clientID
                    ),
                    provider
                )
                provider.emit('status', [{
                    status: 'disconnected'
                }])
            }
        })

        provider.p2pt.on("peerconnect", async peer => {
            console.log(`peer: ${JSON.stringify(peer)}`)
            peer.on('data', msg => {
                if (!msg) {
                    console.log(`received undefined message, skipping. Peer: ${peer.id}`)
                    return;
                }
                try {
                    const messageString = new TextDecoder().decode(msg);
                    if (messageString.startsWith("chat")) {
                        const incomingChatMessage = messageString.substring(4);
                        console.log("chat: " + incomingChatMessage)
                        const messageObject = JSON.parse(incomingChatMessage)
                        console.log(`emitting obj: ${messageObject.from} , ${messageObject.message}`)
                        // provider.emit("chat", incomingChatMessage)
                        provider.notifyChatMessage(messageObject)
                        return;
                    }
                    if (messageString.startsWith("ping")) {
                        const timestamp = messageString.substring(4);
                        console.log(`received ping request`);
                        const pingResponse = { username: provider.username, timestamp }
                        peer.send('pong' + JSON.stringify(pingResponse))
                        return;
                    }
                    if (messageString.startsWith("pong")) {
                        console.log(`received pong ${messageString}`);
                        const timestamp = new Date().getTime();
                        const pongResponse = messageString.substring(4);
                        const pongObject = JSON.parse(pongResponse);
                        const ping = timestamp - pongObject.timestamp;
                        provider.addPingValue(pongObject.username, ping);
                        return;
                    }
                    if (messageString.startsWith("name")) {
                        const username = messageString.substring(4);
                        const peerData = { peer, username }
                        provider.remotePeers.push(peerData);
                        if (provider.userChangeListener) {
                            provider.userChangeListener();
                        }
                        provider.lastMessageReceived = time.getUnixTime()
                        provider.connecting = false
                        provider.connected = true
                        provider.emit('status', [{
                            status: 'connected'
                        }])
                        // always send sync step 1 when connected
                        const encoder = encoding.createEncoder()
                        encoding.writeVarUint(encoder, messageSync)
                        syncProtocol.writeSyncStep1(encoder, provider.doc)
                        provider.sendToPeers(encoding.toUint8Array(encoder))
                        // broadcast local awareness state
                        if (provider.awareness.getLocalState() !== null) {
                            const encoderAwarenessState = encoding.createEncoder()
                            encoding.writeVarUint(encoderAwarenessState, messageAwareness)
                            encoding.writeVarUint8Array(
                                encoderAwarenessState,
                                awarenessProtocol.encodeAwarenessUpdate(provider.awareness, [
                                    provider.doc.clientID
                                ])
                            )
                            provider.sendToPeers(encoding.toUint8Array(encoderAwarenessState))
                        }
                        return;
                    }
                } catch(e) {
                    console.log(`could not parse message: ${msg}, error: ${e}`)
                }
                provider.lastMessageReceived = time.getUnixTime()
                const encoder = readMessage(provider, new Uint8Array(msg), true)
                if (encoding.length(encoder) > 1) {
                    provider.sendToPeers(encoding.toUint8Array(encoder))
                }
            })
            peer.send(`name${provider.username}`)
        })

        provider.p2pt.on("trackerconnect", (tracker, stats) => {
            console.log(`Connected to tracker ${tracker ? tracker.announceUrl : "null"}, connected: ${stats ? stats.connected : "null"}, total: ${stats ? stats.total : "null"}`)
        })

        provider.emit('status', [{
            status: 'connecting'
        }])

        provider.p2pt.start()
    }
}


export class P2ptProvider extends ObservableV2 {

    constructor(roomname, doc, username) {
        super()
        const channelIdentifier = `${IDENTIFIER}/${roomname}`;
        this.p2pt = new P2PT(trackersAnnounceURLs, channelIdentifier);
        this.roomname = roomname
        this.doc = doc
        this.awareness = new awarenessProtocol.Awareness(doc)
        this.connected = false
        this.connecting = false
        this.messageHandlers = messageHandlers.slice()
        this.remotePeers = [];
        this.username = username
        /**
         * @type {boolean}
         */
        this._synced = false
        this.lastMessageReceived = 0
        /**
         * Whether to connect to other peers or not
         * @type {boolean}
         */
        this.shouldConnect = true

        /**
         * Listens to Yjs updates and sends them to remote peers
         * @param {Uint8Array} update
         * @param {any} origin
         */
        this._updateHandler = (update, origin) => {
            if (origin !== this) {
                const encoder = encoding.createEncoder()
                encoding.writeVarUint(encoder, messageSync)
                syncProtocol.writeUpdate(encoder, update)
                this.sendToPeers(encoding.toUint8Array(encoder))
            }
        }
        this.doc.on('update', this._updateHandler)
        /**
         * @param {any} changed
         * @param {any} _origin
         */
        this._awarenessUpdateHandler = ({ added, updated, removed }, _origin) => {
            const changedClients = added.concat(updated).concat(removed)
            const encoder = encoding.createEncoder()
            encoding.writeVarUint(encoder, messageAwareness)
            encoding.writeVarUint8Array(
                encoder,
                awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
            )
            this.sendToPeers(encoding.toUint8Array(encoder))
        }
        this._exitHandler = () => {
            awarenessProtocol.removeAwarenessStates(
                this.awareness,
                [doc.clientID],
                'app closed'
            )
        }
        if (env.isNode && typeof process !== 'undefined') {
            process.on('exit', this._exitHandler)
        }
        this.awareness.on('update', this._awarenessUpdateHandler)
        this._checkInterval = /** @type {any} */ (setInterval(() => {
            if (
                this.connected &&
                messageReconnectTimeout <
                time.getUnixTime() - this.lastMessageReceived
            ) {
                //  (this.ws).close()
                console.log("No awareness update is being received")
            }
        }, messageReconnectTimeout / 10))
        this.connect()

    }


    sendToPeers(msg) {
        this.remotePeers.forEach(({ peer }) => peer.send(msg));
    }

    getPeerUsernames() {
        return this.remotePeers.map(({username}) => username)
    }

    sendToSinglePeer(peerUsername, data) {
        const targetPeer = this.remotePeers.find(({ username }) => username === peerUsername)
        if (targetPeer) {
            targetPeer.send(data);
        }
    }
    
    sendChatMessage(message) {
        const messageObject = { from: this.username, message }
        this.sendToPeers('chat' + JSON.stringify(messageObject))
    }

    isUsernameTaken(peerUsername) {
        return this.remotePeers.some(({username}) => peerUsername === username)
    }

    /**
     * @type {boolean}
     */
    get synced() {
        return this._synced
    }

    set synced(state) {
        if (this._synced !== state) {
            this._synced = state
            this.emit('synced', [state])
            this.emit('sync', [state])
        }
    }

    destroy() {
        clearInterval(this._checkInterval)
        this.disconnect()
        if (env.isNode && typeof process !== 'undefined') {
            process.off('exit', this._exitHandler)
        }
        this.awareness.off('update', this._awarenessUpdateHandler)
        this.doc.off('update', this._updateHandler)
        super.destroy()
    }

    disconnect() {
        this.shouldConnect = false
        this.p2pt.destroy();
    }

    connect() {
        this.shouldConnect = true
        console.log("is connected?", this.connected)
        if (!this.connected) {
            setupPeerConnection(this)
        }
    }

    setChatMessageHandler(handler) {
        this.chatMessageHandler = handler;
    }

    notifyChatMessage(message) {
        if (this.chatMessageHandler) {
            this.chatMessageHandler(message);
        }
    }

    setUserChangeListener(listener) {
        this.userChangeListener = listener
    }

    getPeerPing(peerUsername) {
        const targetPeer = this.remotePeers.find(({username}) => username === peerUsername);
        if (targetPeer && targetPeer.ping) {
            return targetPeer.ping;
        }
        return null;
    }
    
    sendPeerPing(peerUsername) {
        const targetPeer = this.remotePeers.find(({username}) => username === peerUsername);
        if (targetPeer && targetPeer.peer) {
            const timestamp = new Date().getTime();
            targetPeer.peer.send('ping' + timestamp);
        }
    }

    addPingValue(peerUsername, ping) {
        const targetPeer = this.remotePeers.find(({username}) => username === peerUsername);
        if (targetPeer) {
            targetPeer.ping = ping
            if (this.userChangeListener) this.userChangeListener();
        }
    }
}