import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import App from './App.jsx'

// Remove StrictMode in production to prevent double API calls
const AppWrapper = process.env.NODE_ENV === 'development' ? 
  ({ children }) => <StrictMode>{children}</StrictMode> : 
  ({ children }) => children;

createRoot(document.getElementById('root')).render(
  <AppWrapper>
    <Provider store={store}>
      <App />
    </Provider>
  </AppWrapper>,
)
