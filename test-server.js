// Simple test to identify the issue
const express = require('express');
const chalk = require('chalk');

console.log('🔍 Testing Express server...');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send('<h1>✅ Server is working!</h1><p>The auto-poster should work now.</p>');
});

app.listen(PORT, () => {
    console.log(chalk.green(`✅ Test server running on port ${PORT}`));
    console.log(`Go to: http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error(chalk.red('❌ Server error:'), err);
});
