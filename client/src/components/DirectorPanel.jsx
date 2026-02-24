
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function DirectorPanel() {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get('/api/analytics/multi-year')
      .then(res => setData(res.data));
  }, []);

  return (
    <div>
      <h2>Director Strategic Analytics</h2>
      {data.map((row, idx) => (
        <div key={idx}>
          Year: {row.year} | Avg Performance: {row.avg_performance} | Avg Risk: {row.avg_risk}
        </div>
      ))}
    </div>
  );
}
