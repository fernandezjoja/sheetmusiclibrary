import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ScoresList from './pages/ScoresList.tsx'
import ScoreDetail from './pages/ScoreDetail.tsx'
import AdminUpload from './pages/AdminUpload.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<ScoresList />} />
          <Route path="scores/:id" element={<ScoreDetail />} />
          <Route path="admin" element={<AdminUpload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
