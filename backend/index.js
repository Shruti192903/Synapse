import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import agentRoutes from './routes/agentRoutes.js';
import connectDB from './db.js';

dotenv.config({ path: './backend/.env' });
connectDB();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
    origin: 'http://localhost:3000', // Allow Next.js frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/agent', agentRoutes);

app.get('/', (req, res) => {
    res.send('Synapse Agent Backend Running.');
});

app.listen(PORT, () => {
    console.log(`Synapse Backend listening on port ${PORT}`);
});