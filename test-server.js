const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!', env: process.env.NODE_ENV });
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: false });
});

app.use(express.static('static'));

app.listen(PORT, () => {
  console.log(`Test server on port ${PORT}`);
});
