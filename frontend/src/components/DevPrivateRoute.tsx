import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { restoreDevSession } from '../services/devApi';

interface DevPrivateRouteProps {
  children: React.ReactElement;
}

const DevPrivateRoute: React.FC<DevPrivateRouteProps> = ({ children }) => {
  const [state, setState] = useState<'loading'|'valid'|'invalid'>('loading');
  useEffect(() => { restoreDevSession().then(token => setState(token ? 'valid' : 'invalid')) }, []);
  if (state === 'loading') return <div style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#08090f',color:'#e8b86d'}}>Developer-Sitzung wird geprüft…</div>;
  if (state === 'invalid') return <Navigate to="/dev-login" replace />;

  return children;
};

export default DevPrivateRoute;
