import React from 'react'
import ReactDOM from 'react-dom/client'
import MarketingSite from './pages/MarketingSite'
import './marketing-site.css'
import './flight-story.css'
import './mountain-hero.css'
import './aircraft-details.css'
import './final-flight.css'
if(new URLSearchParams(window.location.search).get('aircraft')!=='h145')document.body.classList.add('light-twin-review')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><MarketingSite /></React.StrictMode>,
)
