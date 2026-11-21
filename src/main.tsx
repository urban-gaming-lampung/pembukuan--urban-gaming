import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './lib/nativeAlert'
import { PemberitahuanHost } from './ui/presentations/Pemberitahuan'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PemberitahuanHost />
  </React.StrictMode>,
)
