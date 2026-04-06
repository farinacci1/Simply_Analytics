import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createDashboardSlice } from '../../client/src/store/slices/dashboardSlice';

const createTestStore = () =>
  create((...a) => ({
    ...createDashboardSlice(...a),
  }));

describe('dashboardSlice – filter actions', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
  });

  it('initialises with empty dashboardFilters and widgetRefreshKey 0', () => {
    const state = store.getState();
    expect(state.dashboardFilters).toEqual({});
    expect(state.widgetRefreshKey).toBe(0);
  });

  describe('setDashboardFilter', () => {
    it('adds a filter entry keyed by filterWidgetId', () => {
      store.getState().setDashboardFilter('region', { field: 'REGION', operator: 'IN', values: ['US'] });
      expect(store.getState().dashboardFilters.region).toEqual({
        field: 'REGION',
        operator: 'IN',
        values: ['US'],
      });
    });

    it('increments widgetRefreshKey', () => {
      const before = store.getState().widgetRefreshKey;
      store.getState().setDashboardFilter('x', {});
      expect(store.getState().widgetRefreshKey).toBe(before + 1);
    });

    it('overwrites an existing filter', () => {
      store.getState().setDashboardFilter('region', { values: ['US'] });
      store.getState().setDashboardFilter('region', { values: ['EU'] });
      expect(store.getState().dashboardFilters.region).toEqual({ values: ['EU'] });
    });
  });

  describe('removeDashboardFilter', () => {
    it('removes the specified filter', () => {
      store.getState().setDashboardFilter('a', { v: 1 });
      store.getState().setDashboardFilter('b', { v: 2 });
      store.getState().removeDashboardFilter('a');

      expect(store.getState().dashboardFilters.a).toBeUndefined();
      expect(store.getState().dashboardFilters.b).toEqual({ v: 2 });
    });

    it('increments widgetRefreshKey', () => {
      store.getState().setDashboardFilter('a', {});
      const before = store.getState().widgetRefreshKey;
      store.getState().removeDashboardFilter('a');
      expect(store.getState().widgetRefreshKey).toBe(before + 1);
    });
  });

  describe('clearDashboardFilters', () => {
    it('resets dashboardFilters to empty', () => {
      store.getState().setDashboardFilter('a', {});
      store.getState().setDashboardFilter('b', {});
      store.getState().clearDashboardFilters();
      expect(store.getState().dashboardFilters).toEqual({});
    });
  });

  describe('triggerWidgetRefresh', () => {
    it('increments widgetRefreshKey by 1', () => {
      const before = store.getState().widgetRefreshKey;
      store.getState().triggerWidgetRefresh();
      expect(store.getState().widgetRefreshKey).toBe(before + 1);
    });
  });
});
