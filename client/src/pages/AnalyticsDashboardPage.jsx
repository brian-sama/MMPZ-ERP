import React from 'react';
import PageHeader from '../components/PageHeader';

const AnalyticsDashboardPage = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Advanced Analytics" />
      <div className="flex-1 w-full bg-white rounded-lg shadow mt-4 p-0 overflow-hidden relative">
        <iframe
          src="/streamlit/?embed=true"
          title="Streamlit Analytics"
          className="w-full h-full border-0 absolute top-0 left-0"
          sandbox="allow-scripts allow-popups allow-forms"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default AnalyticsDashboardPage;
