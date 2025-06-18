import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetails } from './pages/JobDetails';
import { CreateJob } from './pages/CreateJob';
import { Notifications } from './pages/Notifications';
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-900">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/create" element={<CreateJob />} />
              <Route path="/jobs/:id" element={<JobDetails />} />
              <Route path="/notifications" element={<Notifications />} />
            </Routes>
          </Layout>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;