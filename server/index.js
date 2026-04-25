const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 5000;
app.use(cors());
app.get('/test-ai', async (req, res) => {
    try {
        // Here, Node.js is calling our Python FastAPI server
        const response = await axios.get('http://127.0.0.1:8000/analyze?amount=150000');
        res.json({
            message: "Node.js successfully talked to Python!",
            ai_response: response.data
        });
    } catch (error) {
        res.status(500).json({ error: "Could not reach AI engine" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});