import { useState } from 'react';
import { useAppStore } from '../../../store/appStore';
import { semanticApi } from '../../../api/apiClient';

/**
 * Manages AI insight generation state and API calls for a widget.
 */
export default function useWidgetInsights({ widget, semanticViewFQN, data }) {
  const { currentDashboard } = useAppStore();

  const [showInsights, setShowInsights] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  const generateInsights = async () => {
    if (!data?.rows?.length) {
      setInsightsError('No data available for insights');
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);
    setShowInsights(true);

    try {
      const result = await semanticApi.cortexInsights({
        data: data.rows,
        query: `Widget: ${widget.title}`,
        semanticView: semanticViewFQN,
        connectionId: currentDashboard?.connection_id,
        role: currentDashboard?.role,
        warehouse: currentDashboard?.warehouse,
      });

      let parsedInsights = result.insights;
      if (parsedInsights && typeof parsedInsights === 'string') {
        try {
          const parsed = JSON.parse(parsedInsights);
          if (parsed.choices?.[0]) {
            parsedInsights = parsed.choices[0].messages || parsed.choices[0].message?.content || parsedInsights;
          }
        } catch { /* not JSON */ }
      }
      setInsights(parsedInsights);
    } catch (err) {
      console.error('Insights error:', err);
      setInsightsError(err.message);
    } finally {
      setInsightsLoading(false);
    }
  };

  return {
    showInsights, setShowInsights,
    insights, insightsLoading, insightsError,
    generateInsights,
  };
}
