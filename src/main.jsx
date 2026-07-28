import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, Bot, CloudSun, Compass, ExternalLink, LoaderCircle, MapPin, Menu, MessageCircle, RefreshCw, Send, Sparkles, Users, Waves, X } from 'lucide-react'
import './styles.css'

const SHEET_ID = '1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw'
const SHEET_GID = '120683740'
const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`
const SHEET_ENDPOINT = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`

const clean = value => String(value ?? '').trim()
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const valueOf = (row, names) => { const found = Object.keys(row).find(item => names.includes(key(item))); return found ? clean(row[found]) : '' }

async function fetchTours() {
  const response = await fetch(`${SHEET_ENDPOINT}&_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Google Sheet returned ${response.status}`)
  const raw = await response.text()
  const start = raw.indexOf('(')
  const table = JSON.parse(raw.slice(start + 1, raw.lastIndexOf(')'))).table
  const labels = table.cols.map(column => clean(column.label))
  const rows = table.rows.map(row => row.c.map(cell => clean(cell?.f ?? cell?.v)))
  const headers = labels.some(Boolean) ? labels : rows.shift() || []
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] || '']))).filter(row => Object.values(row).some(Boolean))
}

function tourView(row) {
  return {
    name: valueOf(row, ['tour', 'tour_name', 'name', 'service_name', 'title']),
    location: valueOf(row, ['location', 'destination', 'area', 'region', 'departure_location']),
    price: valueOf(row, ['price', 'price_eur', 'price_euro', 'cost', 'price_usd']),
    availability: valueOf(row, ['slots_this_week', 'slots', 'places', 'spaces', 'availability', 'available']),
    date: valueOf(row, ['date', 'tour_date', 'departure_date']),
    offer: valueOf(row, ['special_offer', 'offer', 'discount', 'promotion']),
    duration: valueOf(row, ['duration', 'length']),
    description: valueOf(row, ['description', 'details', 'type', 'category']),
    raw: row,
  }
}

function weatherText(code) {
  if ([0, 1].includes(code)) return 'clear skies'
  if ([2, 3].includes(code)) return 'partly cloudy conditions'
  if ([45, 48].includes(code)) return 'foggy conditions'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  if ([95, 96, 99].includes(code)) return 'thunderstorms'
  return 'changeable conditions'
}

async function fetchWeather(location = 'Galway') {
  const search = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`)
  if (!search.ok) throw new Error('Location lookup failed')
  const place = (await search.json()).results?.[0]
  if (!place) throw new Error(`I could not find weather data for ${location}`)
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&hourly=precipitation_probability&forecast_days=1&timezone=auto`)
  if (!response.ok) throw new Error('Weather service unavailable')
  const data = await response.json()
  return { place, current: data.current, rainChance: Math.max(...(data.hourly?.precipitation_probability || [0])) }
}

function weatherLocation(question) {
  const match = question.match(/(?:weather|forecast|conditions)(?:\s+(?:in|for|at))?\s+([a-z][a-z -]{2,30})/i)
  return match?.[1]?.replace(/[?.!,].*$/, '').trim() || 'Galway'
}

function priceWarning(price) {
  const number = Number(String(price).replace(/[^0-9.]/g, ''))
  return number > 0 && number < 5 ? ' This live price looks unusually low, so please confirm it with a human team member before booking.' : ''
}

function localAnswer(question, tours, weather) {
  const text = question.toLowerCase()
  const views = tours.map(tourView).filter(tour => tour.name || tour.description)
  if (text.includes('food') || text.includes('restaurant') || text.includes('order')) return 'I’m Atlantic Coast Tours’ travel assistant, so I can help with tours, weather and trip planning, but I can’t place food orders.'
  if (text.includes('flight')) return 'I can help you plan a trip, but I can’t search or book flights from this chat. A human member of the Atlantic Coast Tours team can help with that.'
  if (text.includes('interesting') || text.includes('ireland')) return 'Ireland’s Atlantic coast is shaped by the Gulf Stream, which helps keep the west coast remarkably mild for its latitude. For a local experience, ask me about the live tours in the sheet.'
  if (text.includes('weather') || text.includes('forecast') || text.includes('suitable') || text.includes('rain')) {
    if (!weather) return 'The live weather service did not respond, so I can’t assess conditions safely right now.'
    const { place, current, rainChance } = weather
    const suitable = current.weather_code <= 3 && current.wind_speed_10m < 35 && rainChance < 70
    return `${place.name}, ${place.country} currently has ${Math.round(current.temperature_2m)}°C, ${weatherText(current.weather_code)} and wind around ${Math.round(current.wind_speed_10m)} km/h. Today’s forecast rain probability reaches ${rainChance}%. ${suitable ? 'That looks broadly suitable for a coastal tour, with a warm layer and waterproofs.' : 'Conditions look mixed for a coastal tour, so check with the team before setting out.'}`
  }
  let selected = views
  if (text.includes('cheap')) selected = [...views].sort((a, b) => (Number(a.price.replace(/[^0-9.]/g, '')) || Number.POSITIVE_INFINITY) - (Number(b.price.replace(/[^0-9.]/g, '')) || Number.POSITIVE_INFINITY)).slice(0, 1)
  if (text.includes('offer')) selected = views.filter(tour => tour.offer)
  if (text.includes('available') || text.includes('week') || text.includes('recommend')) selected = views.filter(tour => !/^0$|full|sold|none|unavailable/i.test(tour.availability))
  if (text.includes('no available') || text.includes('fully booked')) selected = views.filter(tour => /^0$|full|sold|none|unavailable/i.test(tour.availability))
  if (text.includes('offer') && !selected.length) return 'I checked the live tour sheet and found no special offers listed right now.'
  if (!selected.length) return `I checked the live Google Sheet, but I couldn’t find a matching tour. Ask “What tours do you offer?” to see the current live catalogue.`
  const intro = text.includes('cheap') ? 'The cheapest live option appears to be:' : text.includes('offer') ? 'These live rows include an offer:' : text.includes('no available') ? 'These tours are marked as having no availability in the live sheet:' : `I found ${selected.length} live tour${selected.length === 1 ? '' : 's'} matching that:`
  const weatherNote = text.includes('recommend') && weather ? (weather.current.weather_code <= 3 && weather.current.wind_speed_10m < 35 ? ' The current forecast is broadly favourable for outdoor touring.' : ' The current forecast is mixed, so bring waterproofs and confirm conditions with the team.') : ''
  return `${intro}${weatherNote}\n\n${selected.slice(0, 6).map(tour => `• ${tour.name || 'Unnamed tour'}${tour.location ? ` · ${tour.location}` : ''}${tour.price ? ` · ${tour.price}` : ''}${tour.availability ? ` · Places this week: ${tour.availability}` : ''}${tour.offer ? ` · Offer: ${tour.offer}` : ''}${priceWarning(tour.price)}`).join('\n')}`
}

async function askModel(question, tours, weather) {
  const context = JSON.stringify({ tours: tours.map(tourView), weather })
  const instructions = `You are Atlantic Coast Tours' customer assistant. Answer naturally and concisely using only the live context below. Never invent, normalize, or correct prices, dates, availability or offers. If a price looks unrealistic, quote it exactly and warn the customer to confirm with a human. Say clearly when information is absent. You cannot take payments, book flights, or order food.\nLIVE CONTEXT:\n${context}\nCUSTOMER: ${question}`
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context, instructions }) })
    if (response.ok) { const data = await response.json(); if (data.text) return data.text }
  } catch { /* GitHub Pages has no server route; the grounded answer remains available. */ }
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(import.meta.env.VITE_GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: instructions }] }] }) })
    if (response.ok) return (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || null
  }
  return null
}

function App() {
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Hello, I’m your Atlantic Coast Tours assistant. I can check our live tours, availability, prices and west-coast weather. What would you like to explore?' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Live sources ready')
  const [menu, setMenu] = useState(false)

  async function send(question = input) {
    const trimmed = question.trim()
    if (!trimmed || loading) return
    setInput(''); setLoading(true); setStatus('Checking live sheet and weather…')
    setMessages(current => [...current, { from: 'user', text: trimmed }])
    try {
      const tours = await fetchTours()
      const needsWeather = /weather|forecast|suitable|rain|coastal tour/i.test(trimmed)
      const weather = needsWeather ? await fetchWeather(weatherLocation(trimmed)) : null
      const modelAnswer = await askModel(trimmed, tours, weather)
      setMessages(current => [...current, { from: 'bot', text: modelAnswer || localAnswer(trimmed, tours, weather), live: true }])
      setStatus(`Live data checked just now · ${tours.length} rows found`)
    } catch (error) {
      setMessages(current => [...current, { from: 'bot', text: `I couldn’t reach the live Google Sheet, so I won’t guess. Please try again or contact a human member of the team. (${error.message})` }])
      setStatus('Live source unavailable')
    } finally { setLoading(false) }
  }

  return <div className="page"><header className="topbar"><a className="logo" href="#top"><span className="logo-mark"><Waves size={20} /></span><span>Atlantic Coast <b>Tours</b></span></a><nav className={menu ? 'open' : ''}><a href="#explore">Explore</a><a href="#chat">Ask the assistant</a><a href={SHEET_LINK} target="_blank" rel="noreferrer">Staff data <ExternalLink size={13} /></a></nav><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X /> : <Menu />}</button><div className="header-status"><span /> Live assistant</div></header>
    <main id="top"><section className="hero"><div className="hero-copy"><p className="eyebrow"><Sparkles size={14} /> Your west coast guide</p><h1>Make room for<br /><em>the wild Atlantic.</em></h1><p className="hero-text">Discover remarkable places, local stories and unforgettable days out across the west of Ireland.</p><a className="hero-link" href="#chat">Start planning <ArrowUpRight size={16} /></a></div><div className="hero-art"><div className="sun" /><div className="cliff cliff-back" /><div className="cliff cliff-front" /><div className="hero-stamp"><Compass size={18} /><span>West is<br /><b>calling</b></span></div></div></section>
      <section className="trust-row"><div><span className="trust-icon"><Users size={17} /></span><strong>Local knowledge</strong><small>Guided by people who know the coast</small></div><div><span className="trust-icon"><CloudSun size={17} /></span><strong>Live conditions</strong><small>Weather from Open-Meteo, checked live</small></div><div><span className="trust-icon"><MessageCircle size={17} /></span><strong>Ask anything</strong><small>Grounded answers, not guesswork</small></div></section>
      <section className="chat-section" id="chat"><div className="section-intro"><p className="eyebrow">The Atlantic guide</p><h2>Where will the road<br />take you?</h2><p>Ask about tours, prices, availability or today’s weather. I’ll check the connected tour sheet each time you ask.</p><div className="ai-notice"><Bot size={17} /><span><b>You’re chatting with an AI assistant.</b> It can make mistakes. Please confirm important details, prices and bookings with our team.</span></div></div><div className="chat-card"><div className="chat-head"><div className="bot-avatar"><Waves size={18} /></div><div><strong>Atlantic assistant</strong><small><span className="online" /> Checking live sources</small></div><button onClick={() => setMessages([{ from: 'bot', text: 'Hello, I’m your Atlantic Coast Tours assistant. What would you like to explore?' }])} aria-label="Reset chat"><RefreshCw size={16} /></button></div><div className="messages" aria-live="polite">{messages.map((message, index) => <div className={`message ${message.from}`} key={`${index}-${message.text}`}><div className="message-avatar">{message.from === 'bot' ? <Bot size={14} /> : 'You'}</div><div className="bubble">{message.text.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i < message.text.split('\n').length - 1 && <br />}</React.Fragment>)}{message.live && <small className="grounded"><span /> Grounded in live sources</small>}</div></div>)}{loading && <div className="message bot"><div className="message-avatar"><Bot size={14} /></div><div className="bubble typing"><LoaderCircle size={15} /> Checking now…</div></div>}</div><div className="quick-prompts">{['What tours do you offer?', 'What’s the weather in Galway?', 'Recommend an available tour'].map(prompt => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div><form onSubmit={event => { event.preventDefault(); send() }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about your next adventure…" aria-label="Ask Atlantic assistant" /><button type="submit" disabled={loading || !input.trim()} aria-label="Send question"><Send size={17} /></button></form><div className="source-status"><span className={status.includes('unavailable') ? 'offline' : ''} /> {status} <a href={SHEET_LINK} target="_blank" rel="noreferrer">View source sheet <ExternalLink size={11} /></a></div></div></section>
      <section className="explore" id="explore"><div><p className="eyebrow">Go beyond the postcard</p><h2>From sea stacks<br />to slow Sundays.</h2></div><div className="explore-note"><MapPin size={19} /><p>The tours shown in conversation always come directly from our connected Google Sheet. Nothing is copied into this page.</p></div></section>
    </main><footer><a className="logo" href="#top"><span className="logo-mark"><Waves size={15} /></span><span>Atlantic Coast <b>Tours</b></span></a><span>West of Ireland · <a href="#chat">Plan your day</a></span></footer></div>
}

createRoot(document.getElementById('root')).render(<App />)
