import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider, RequireAuth } from './auth.tsx'
import Home from './pages/Home.tsx'
import Learn from './pages/Learn.tsx'
import LoginPage from './pages/LoginPage.tsx'
import ScoresList from './pages/ScoresList.tsx'
import ScoreDetail from './pages/ScoreDetail.tsx'
import AdminHub from './pages/AdminHub.tsx'
import AdminUpload from './pages/AdminUpload.tsx'
import AdminEdit from './pages/AdminEdit.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Home />} />
            <Route path="learn" element={<Learn />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="biblioteca" element={<ScoresList />} />
            <Route path="scores/:id" element={<ScoreDetail />} />
            <Route
              path="admin"
              element={
                <RequireAuth role="ADMIN">
                  <AdminHub />
                </RequireAuth>
              }
            />
            <Route
              path="admin/upload"
              element={
                <RequireAuth role="ADMIN">
                  <AdminUpload />
                </RequireAuth>
              }
            />
            <Route
              path="admin/edit/:id"
              element={
                <RequireAuth role="ADMIN">
                  <AdminEdit />
                </RequireAuth>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
