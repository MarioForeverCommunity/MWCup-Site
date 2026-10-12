import { createApp } from 'vue'
import '@fontsource/inter/400.css'
import "@fontsource/inter/400-italic.css";
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/style.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
