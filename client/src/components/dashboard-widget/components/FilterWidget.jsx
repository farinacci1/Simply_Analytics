import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/appStore';
import { semanticApi } from '../../../api/apiClient';
import {
  FiFilter, FiEdit3, FiCalendar, FiChevronDown, FiSearch, FiX,
} from 'react-icons/fi';

const FilterWidget = ({ widget, semanticViewFQN, isEditMode, onEdit }) => {
  const { currentDashboard, setDashboardFilter, removeDashboardFilter } = useAppStore();

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValues, setFilterValues] = useState(widget.config?.filterValues || []);
  const [filterFieldDistinct, setFilterFieldDistinct] = useState([]);

  const filterField = widget.config?.filterField || '';
  const filterType = widget.config?.filterType || 'dropdown';
  const label = widget.config?.filterLabel || filterField || 'Filter';

  // Fetch distinct values for the filter field
  useEffect(() => {
    if (!filterField || !semanticViewFQN) return;
    let cancelled = false;

    const fetchDistinct = async () => {
      try {
        const result = await semanticApi.query({
          semanticView: semanticViewFQN,
          dimensions: [filterField],
          measures: [],
          filters: [],
          orderBy: [{ field: filterField, direction: 'ASC' }],
          limit: 500,
          connectionId: currentDashboard?.connection_id,
          role: currentDashboard?.role,
          warehouse: currentDashboard?.warehouse,
        });
        if (!cancelled && result?.data) {
          const vals = [...new Set(result.data.map(r => {
            const key = Object.keys(r).find(k => k.toUpperCase() === filterField.toUpperCase());
            return key ? r[key] : null;
          }).filter(Boolean))];
          setFilterFieldDistinct(vals);
        }
      } catch (err) {
        console.error('Filter distinct fetch error:', err);
      }
    };
    fetchDistinct();
    return () => { cancelled = true; };
  }, [filterField, semanticViewFQN, currentDashboard?.connection_id]);

  // Push filter changes to global dashboard filters
  useEffect(() => {
    if (!filterField) return;
    if (filterValues.length > 0) {
      setDashboardFilter(widget.id, {
        field: filterField,
        operator: filterType === 'date-range' ? 'between' : 'in',
        values: filterValues,
      });
    } else {
      removeDashboardFilter(widget.id);
    }
  }, [filterValues, filterField, filterType, widget.id, setDashboardFilter, removeDashboardFilter]);

  if (!filterField) {
    return (
      <div className="filter-widget-content filter-widget-empty">
        <FiFilter style={{ fontSize: 20, opacity: 0.4 }} />
        <span>{isEditMode ? 'Configure filter field' : 'No filter configured'}</span>
        {isEditMode && (
          <button className="btn btn-primary btn-sm" onClick={onEdit}>
            <FiEdit3 /> Configure
          </button>
        )}
      </div>
    );
  }

  if (filterType === 'date-range') {
    return (
      <div className="filter-widget-content">
        <div className="filter-widget-label">{label}</div>
        <div className="filter-widget-date-range">
          <div className="filter-date-input">
            <FiCalendar />
            <input
              type="date"
              value={filterValues[0] || ''}
              onChange={e => setFilterValues([e.target.value, filterValues[1] || ''])}
              placeholder="Start date"
            />
          </div>
          <span className="filter-date-separator">→</span>
          <div className="filter-date-input">
            <FiCalendar />
            <input
              type="date"
              value={filterValues[1] || ''}
              onChange={e => setFilterValues([filterValues[0] || '', e.target.value])}
              placeholder="End date"
            />
          </div>
          {filterValues.some(v => v) && (
            <button className="filter-clear-btn" onClick={() => setFilterValues([])} title="Clear filter">
              <FiX />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="filter-widget-content">
      <div className="filter-widget-label">{label}</div>
      <div className="filter-widget-dropdown">
        <button
          className={`filter-dropdown-trigger ${filterOpen ? 'open' : ''}`}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <span className="filter-dropdown-text">
            {filterValues.length === 0
              ? 'All'
              : filterValues.length === 1
                ? String(filterValues[0])
                : `${filterValues.length} selected`}
          </span>
          <FiChevronDown className={`filter-dropdown-arrow ${filterOpen ? 'rotated' : ''}`} />
        </button>
        {filterOpen && (
          <div className="filter-dropdown-menu">
            <div className="filter-dropdown-search">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                autoFocus
                onChange={e => {
                  const q = e.target.value.toLowerCase();
                  const items = document.querySelectorAll(`.filter-dropdown-menu [data-widget="${widget.id}"] .filter-option`);
                  items.forEach(el => {
                    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
                  });
                }}
              />
            </div>
            <div className="filter-dropdown-options" data-widget={widget.id}>
              {filterValues.length > 0 && (
                <button className="filter-option filter-clear-all" onClick={() => { setFilterValues([]); setFilterOpen(false); }}>
                  Clear all
                </button>
              )}
              {filterFieldDistinct.map(val => (
                <label key={String(val)} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filterValues.includes(val)}
                    onChange={() => {
                      setFilterValues(prev =>
                        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
                      );
                    }}
                  />
                  <span>{String(val)}</span>
                </label>
              ))}
              {filterFieldDistinct.length === 0 && (
                <div className="filter-option-empty">Loading values...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterWidget;
