import express from 'express';
import bodyParser from 'body-parser';

import cors from 'cors';

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  })
);
app.use(bodyParser.json());

const groupTrainingRequests: any[] = [];

app.post('/api/trainings/group-request', (req, res) => {
    const { fullName, email, phone, organization, topic, participants, preferredDate } = req.body;

    if (!fullName || !email || !phone || !organization || !topic || !participants || !preferredDate) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const newRequest = {
        id: groupTrainingRequests.length + 1,
        fullName,
        email,
        phone,
        organization,
        topic,
        participants,
        preferredDate,
        status: 'Pending',
        notes: '',
    };

    groupTrainingRequests.push(newRequest);

    // Notify admin (placeholder logic)
    console.log('New group training request received:', newRequest);

    res.status(201).json({ message: 'Request submitted successfully.' });
});

export default app;
