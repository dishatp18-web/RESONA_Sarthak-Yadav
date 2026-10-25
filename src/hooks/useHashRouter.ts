import { useState, useEffect, useCallback } from 'react';

export interface RouteState {
  path: string;
  subpath?: string;
  param?: string;
  query: Record<string, string>;
  rawHash: string;
}

export function parseHash(hashString: string): RouteState {
  const clean = (hashString || '').replace(/^#\/?/, '');
  const [routePart, queryPart] = clean.split('?');
  
  const query: Record<string, string> = {};
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    params.forEach((v, k) => {
      query[k] = v;
    });
  }

  // Check if ?app query or recording mode exists to skip welcome
  const hasAppQuery = Boolean(
    query.app || 
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('app'))
  );
  const isRecordingMode = typeof window !== 'undefined' && window.localStorage?.getItem('fairfix_recording_mode') === 'true';

  const defaultPath = (hasAppQuery || isRecordingMode) ? 'home' : 'welcome';
  const segments = (routePart || defaultPath).split('/').filter(Boolean);

  const path = segments[0] || defaultPath;
  const subpath = segments[1];
  const param = segments[2];

  return {
    path,
    subpath,
    param,
    query,
    rawHash: hashString || `#/${defaultPath}`,
  };
}

export function useHashRouter() {
  const [route, setRoute] = useState<RouteState>(() => {
    if (typeof window === 'undefined') {
      return { path: 'welcome', query: {}, rawHash: '#/welcome' };
    }
    return parseHash(window.location.hash);
  });

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    // If no initial hash, set default #/welcome (or #/home if ?app / recording mode)
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      const hasAppQuery = new URLSearchParams(window.location.search).has('app');
      const isRecordingMode = window.localStorage?.getItem('fairfix_recording_mode') === 'true';
      window.location.hash = (hasAppQuery || isRecordingMode) ? '#/home' : '#/welcome';
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : '/' + to}`;
    if (window.location.hash === target) {
      setRoute(parseHash(target));
    } else {
      window.location.hash = target;
    }
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('#/home');
    }
  }, [navigate]);

  return {
    route,
    navigate,
    goBack,
  };
}
