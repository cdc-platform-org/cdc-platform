import React, { useState } from 'react';
import axios from 'axios';

interface ExportButtonProps {
  exportType: 'pdf' | 'docx';
  content: { title: string; sections: { heading: string; body: string[] }[] };
}

const ExportButton: React.FC<ExportButtonProps> = ({ exportType, content }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`/api/export/${exportType}`, content, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: exportType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export.${exportType}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError('Failed to export document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleExport} disabled={loading}>
        {loading ? 'Exporting...' : `Export as ${exportType.toUpperCase()}`}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default ExportButton;
