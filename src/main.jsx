import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import * as process from "process";
window.process = process;

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
