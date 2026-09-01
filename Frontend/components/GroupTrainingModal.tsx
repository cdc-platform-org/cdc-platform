import React, { useState } from 'react';

interface GroupTrainingModalProps {
    onClose: () => void;
}

export default function GroupTrainingModal({ onClose }: GroupTrainingModalProps) {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        organization: '',
        topic: '',
        participants: '',
        preferredDate: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/trainings/group-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (response.ok) {
                alert('Request submitted successfully!');
                onClose();
            } else {
                alert('Failed to submit the request.');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            alert('An error occurred. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                <h2 className="text-xl font-bold mb-4">Request Group Training</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        name="fullName"
                        placeholder="Full Name"
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="tel"
                        name="phone"
                        placeholder="Phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="text"
                        name="organization"
                        placeholder="Organization/School"
                        value={formData.organization}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="text"
                        name="topic"
                        placeholder="Requested Topic"
                        value={formData.topic}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="number"
                        name="participants"
                        placeholder="Number of Participants"
                        value={formData.participants}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <input
                        type="datetime-local"
                        name="preferredDate"
                        value={formData.preferredDate}
                        onChange={handleChange}
                        className="w-full mb-2 p-2 border rounded"
                        required
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            className="px-4 py-2 bg-gray-300 rounded-lg mr-2"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg">
                            Submit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
