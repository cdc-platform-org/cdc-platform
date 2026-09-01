import express from 'express';
import bodyParser from 'body-parser';

const app = express();
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
