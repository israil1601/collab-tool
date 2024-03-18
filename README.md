# Collaboration tool

Collaboration tool project for ELEC-E7320 - Internet Protocols D course. Project relies on WebRTC for client communication and Yjs for collaborative editing cabapilities (CRDT).

## Project status
1. Currently, project only supports collaborative editing of a single document. We will implement ability to handle multiple files later.

2. Project makes use of own provider based on WebRTC & WebTorrent trackers that works with Yjs.

3. Project uses publicly available WebSocket trackers (normally used for WebTorrent) for signaling in WebRTC. This is based on the P2PT library.

4. Styling for the project will be added later.

## Starting the project

1. Install packages: 
```
npm install
```
2. Start the collaboration project:
```
npm run dev
```
