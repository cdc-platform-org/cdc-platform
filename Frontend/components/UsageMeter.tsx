import React from 'react';

interface UsageMeterProps {
  used: number;
  limit: number;
}

const UsageMeter: React.FC<UsageMeterProps> = ({ used, limit }) => {
  const percentage = Math.min((used / limit) * 100, 100);

  return (
    <div className="usage-meter">
      <div className="usage-bar" style={{ width: `${percentage}%` }} />
      <p>
        {used} / {limit} generations used
      </p>
    </div>
  );
};

export default UsageMeter;
