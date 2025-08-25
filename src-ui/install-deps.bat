@echo off
echo ==================================
echo Installing all dependencies...
echo ==================================
echo.

echo Installing core dependencies...
npm install

echo.
echo Installing Tailwind CSS and PostCSS...
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

echo.
echo Installing all other missing dependencies...
npm install react-router-dom lucide-react clsx reactflow framer-motion react-hot-toast zustand
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs 
npm install @radix-ui/react-dropdown-menu @radix-ui/react-switch @radix-ui/react-tooltip 
npm install @radix-ui/react-progress @radix-ui/react-accordion

echo.
echo Installing dev dependencies...
npm install -D @tauri-apps/cli @types/react @types/react-dom @vitejs/plugin-react typescript vite

echo.
echo ==================================
echo All dependencies installed!
echo ==================================
echo.
echo Now run: cd .. && cargo tauri dev
echo.
pause