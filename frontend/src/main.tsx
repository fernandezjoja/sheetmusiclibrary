import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider, RequireAuth } from './auth.tsx'
import { ScoresProvider } from './ScoresProvider.tsx'
import Learn from './pages/Learn.tsx'
import LoginPage from './pages/LoginPage.tsx'
import BibliotecaHub from './pages/BibliotecaHub.tsx'
import Octoechos from './pages/Octoechos.tsx'
import GrandesFiestas from './pages/GrandesFiestas.tsx'
import ServicePage from './pages/ServicePage.tsx'
import ScoresList from './pages/ScoresList.tsx'
import ScoreDetail from './pages/ScoreDetail.tsx'
import AdminHub from './pages/AdminHub.tsx'
import AdminUpload from './pages/AdminUpload.tsx'
import AdminEdit from './pages/AdminEdit.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScoresProvider>
          <Routes>
            <Route path="/" element={<App />}>
              {/* `/` redirects to /biblioteca for now. `replace` keeps the
                  browser history clean — back-button skips this redirect.
                  Restore the Home page by reverting these two lines and the
                  `Home` import above. */}
              <Route index element={<Navigate to="/biblioteca" replace />} />
              <Route path="learn" element={<Learn />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="biblioteca" element={<BibliotecaHub />} />
              <Route path="biblioteca/octoechos" element={<Octoechos />} />
              <Route path="biblioteca/grandesfiestas" element={<GrandesFiestas />} />
              <Route
                path="biblioteca/divinaliturgia"
                element={
                  <RequireAuth>
                    <ServicePage
                      title="Divina Liturgia"
                      tag="service:divina-liturgia"
                      description="Liturgia eucarística."
                      ordinaryOnly
                    />
                  </RequireAuth>
                }
              />
              <Route
                path="biblioteca/visperasmayores"
                element={
                  <RequireAuth>
                    <ServicePage
                      title="Vísperas Mayores"
                      tag="service:visperas"
                      description="Servicio vespertino."
                    />
                  </RequireAuth>
                }
              />
              <Route
                path="biblioteca/panikhida"
                element={
                  <RequireAuth>
                    <ServicePage
                      title="Panikhida"
                      tag="service:panikhida"
                      description="Servicio de conmemoración por los difuntos."
                    />
                  </RequireAuth>
                }
              />
              <Route
                path="biblioteca/matrimonio"
                element={
                  <RequireAuth>
                    <ServicePage
                      title="Matrimonio"
                      tag="service:matrimonio"
                      description="Sacramento del matrimonio."
                    />
                  </RequireAuth>
                }
              />
              <Route
                path="biblioteca/bautismo"
                element={
                  <RequireAuth>
                    <ServicePage
                      title="Bautismo y Crismación"
                      tag="service:bautismo"
                      description="Sacramentos de iniciación."
                    />
                  </RequireAuth>
                }
              />
              <Route path="biblioteca/todas" element={<ScoresList />} />
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
        </ScoresProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
