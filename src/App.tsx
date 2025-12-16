import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Suspense } from 'react';

// Lazy load pages
const Login = React.lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const UserDashboard = React.lazy(() => import('./pages/UserDashboard').then(module => ({ default: module.UserDashboard })));
const IPhoneList = React.lazy(() => import('./pages/devices/IPhoneList').then(module => ({ default: module.IPhoneList })));
const TabletList = React.lazy(() => import('./pages/devices/TabletList').then(module => ({ default: module.TabletList })));
const FeaturePhoneList = React.lazy(() => import('./pages/devices/FeaturePhoneList').then(module => ({ default: module.FeaturePhoneList })));
const RouterList = React.lazy(() => import('./pages/devices/RouterList').then(module => ({ default: module.RouterList })));

const EmployeeList = React.lazy(() => import('./pages/masters/EmployeeList').then(module => ({ default: module.EmployeeList })));
const AreaList = React.lazy(() => import('./pages/masters/AreaList').then(module => ({ default: module.AreaList })));
const AddressList = React.lazy(() => import('./pages/masters/AddressList').then(module => ({ default: module.AddressList })));
const LogList = React.lazy(() => import('./pages/LogList').then(module => ({ default: module.LogList })));
const DeviceManualList = React.lazy(() => import('./pages/DeviceManualList').then(module => ({ default: module.DeviceManualList })));
const DesignPreview = React.lazy(() => import('./pages/DesignPreview').then(module => ({ default: module.DesignPreview })));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
            <Routes>
              <Route path="/design-preview" element={<DesignPreview />} />
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="user-dashboard" element={<UserDashboard />} />
                <Route path="logs" element={<LogList />} />

                <Route path="devices">
                  <Route path="iphones" element={<IPhoneList />} />
                  <Route path="tablets" element={<TabletList />} />
                  <Route path="feature-phones" element={<FeaturePhoneList />} />
                  <Route path="routers" element={<RouterList />} />

                </Route>

                <Route path="masters">
                  <Route path="employees" element={<EmployeeList />} />
                  <Route path="areas" element={<AreaList />} />
                  <Route path="addresses" element={<AddressList />} />
                </Route>

                <Route path="/device-manuals" element={<DeviceManualList />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
