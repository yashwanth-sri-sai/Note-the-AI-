import React, { useState } from 'react';
import axios from 'axios';
import { getAccessToken } from '@/lib/api-client';

export default function TempUploadTest() {
  const [status, setStatus] = useState<string>('Waiting for file...');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('Uploading...');
    const fd = new FormData();
    fd.append('file', file);
    
    const token = getAccessToken();
    const workspaceId = localStorage.getItem('active_workspace_id') || '';

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/documents/upload`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Workspace-ID': workspaceId
          },
          withCredentials: true
        }
      );
      setStatus(`Success! Status: ${response.status}`);
      console.log('Direct axios response:', response);
    } catch (err: any) {
      setStatus(`Failed! ${err.message}`);
      console.error('Direct axios error:', err);
    }
  };

  return (
    <div style={{ padding: '20px', zIndex: 9999, position: 'relative' }}>
      <h2>TEMPORARY DIRECT AXIOS TEST</h2>
      <input type="file" onChange={handleFileChange} />
      <p>{status}</p>
    </div>
  );
}
