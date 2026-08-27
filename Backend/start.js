// Clear require cache before starting
Object.keys(require.cache).forEach(key => {
    delete require.cache[key]
})

// Now start the app
require('./src/app.js')