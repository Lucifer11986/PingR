import React from 'react';
import { Navigate } from 'react-router-dom';

interface DevPublicOnlyRouteProps {
  children: React.ReactElement;
}

const DevPublicOnlyRoute: React.FC<DevPublicOnlyRouteProps> = ({ children }) => {
  const devToken = localStorage.getItem('nokki_dev_token');

  if (devToken) {
    return <Navigate to="/dev-dashboard" replace />;
  }

  return children;
};

export default DevPublicOnlyRoute;
