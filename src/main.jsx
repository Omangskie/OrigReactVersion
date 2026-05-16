import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthContextProvider } from './auth/AuthContext'
import { StoreProvider } from './context/StoreContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="flex flex-col relative">  
      <AuthContextProvider>
        <StoreProvider>
          <RouterProvider router={router}/>
        </StoreProvider>
      </AuthContextProvider>
    </div>
  </StrictMode>,
)
