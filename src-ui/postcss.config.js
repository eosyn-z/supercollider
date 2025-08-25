// PostCSS configuration
let plugins = {};

try {
  // Try to load tailwindcss if it exists
  require.resolve('tailwindcss');
  require.resolve('autoprefixer');
  
  plugins = {
    tailwindcss: {},
    autoprefixer: {},
  };
} catch (e) {
  console.warn('Tailwind CSS not installed yet. Run: npm install -D tailwindcss postcss autoprefixer');
}

export default {
  plugins
}