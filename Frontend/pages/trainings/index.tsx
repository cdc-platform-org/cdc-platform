import GroupTrainingModal from '../../components/GroupTrainingModal';
import { useState } from 'react';

export default function TrainingsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div>
            <h1>Trainings</h1>
            {/* Other content */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Group Trainings / ჯგუფური ტრენინგები</h2>
                <button
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                    onClick={() => setIsModalOpen(true)}
                >
                    Request Group Training
                </button>
            </div>
            {isModalOpen && <GroupTrainingModal onClose={() => setIsModalOpen(false)} />}
        </div>
    );
}
