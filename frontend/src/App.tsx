import { Link, Outlet } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">Biblioteca de Música Litúrgica</Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default App
