import { useState } from 'react';

const mockRequests = [
    {
        id: 1,
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '123456789',
        organization: 'Example School',
        topic: 'AI in Education',
        participants: 20,
        preferredDate: '2026-09-10T10:00',
        status: 'Pending',
        notes: '',
    },
];

export default function GroupTrainingsAdmin() {
    const [requests, setRequests] = useState(mockRequests);

    const updateRequest = (id: number, updates: Partial<(typeof mockRequests)[number]>) => {
        setRequests((prev) =>
            prev.map((req) => (req.id === id ? { ...req, ...updates } : req))
        );
    };

    return (
        <div>
            <h1>Group Training Requests</h1>
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr>
                        <th className="border border-gray-300 p-2">Name</th>
                        <th className="border border-gray-300 p-2">Email</th>
                        <th className="border border-gray-300 p-2">Topic</th>
                        <th className="border border-gray-300 p-2">Participants</th>
                        <th className="border border-gray-300 p-2">Status</th>
                        <th className="border border-gray-300 p-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {requests.map((req) => (
                        <tr key={req.id}>
                            <td className="border border-gray-300 p-2">{req.fullName}</td>
                            <td className="border border-gray-300 p-2">{req.email}</td>
                            <td className="border border-gray-300 p-2">{req.topic}</td>
                            <td className="border border-gray-300 p-2">{req.participants}</td>
                            <td className="border border-gray-300 p-2">{req.status}</td>
                            <td className="border border-gray-300 p-2">
                                <button
                                    className="px-2 py-1 bg-green-500 text-white rounded"
                                    onClick={() => updateRequest(req.id, { status: 'Approved' })}
                                >
                                    Approve
                                </button>
                                <button
                                    className="px-2 py-1 bg-red-500 text-white rounded ml-2"
                                    onClick={() => updateRequest(req.id, { status: 'Declined' })}
                                >
                                    Decline
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
