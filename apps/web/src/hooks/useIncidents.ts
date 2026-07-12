import { useState, useEffect, useCallback } from 'react';
import type { Incident, IncidentSummary } from '@incidentiq/shared-types';
import { getIncidents, getIncidentSummary, getIncident } from '../api/client';
import { useAppContext } from '../context/AppContext';

const PAGE_SIZE = 20;

export function useIncidents() {
  const { state, dispatch } = useAppContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<IncidentSummary>({
    totalOpen: 0,
    totalP1: 0,
    totalP2: 0,
    avgMttr: 0,
    recentIncidents: [],
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchIncidents = useCallback(async (targetPage = 1) => {

    setLoading(true);
    try {
      const [pageData, summaryData] = await Promise.all([
        getIncidents(targetPage, PAGE_SIZE),
        getIncidentSummary(),
      ]);
      setIncidents(pageData.incidents);
      setTotal(pageData.pagination.total);
      setTotalPages(pageData.pagination.totalPages);
      setPage(targetPage);
      setSummary(summaryData);
      dispatch({
        type: 'SET_INCIDENTS',
        payload: (summaryData.recentIncidents ?? pageData.incidents).slice(0, 5),
      });
    } catch {
      setIncidents([]);
      setSummary({
        totalOpen: 0,
        totalP1: 0,
        totalP2: 0,
        avgMttr: 0,
        recentIncidents: [],
      });
      dispatch({ type: 'SET_INCIDENTS', payload: [] });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchIncidents(1);
  }, [fetchIncidents]);

  return {
    incidents,
    summary,
    loading,
    initialLoading,
    page,
    totalPages,
    total,
    goToPage: (p: number) => fetchIncidents(p),
    refresh: () => fetchIncidents(page),
  };
}

export function useIncidentDetail(id: string | undefined) {
  const { state } = useAppContext();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    getIncident(id)
      .then(setIncident)
      .catch(() => {
        const mock = mockIncidents.find(i => i.incidentId === id || i.id === id);
        setIncident(mock || null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { incident, loading };
}
