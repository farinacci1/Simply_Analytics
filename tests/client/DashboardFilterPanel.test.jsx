import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardFilterPanel from '../../client/src/components/dashboard-view/components/DashboardFilterPanel';

vi.mock('../../client/src/styles/DashboardFilterPanel.css', () => ({}));

vi.mock('../../client/src/store/appStore', () => ({
  useAppStore: vi.fn(() => ({
    setDashboardFilter: vi.fn(),
    removeDashboardFilter: vi.fn(),
    getCachedViewMetadata: vi.fn(() => null),
    setCachedViewMetadata: vi.fn(),
  })),
}));

vi.mock('../../client/src/api/apiClient', () => ({
  semanticApi: {
    getView: vi.fn(() => Promise.resolve({ columns: [] })),
    query: vi.fn(() => Promise.resolve({ data: [] })),
  },
}));

vi.mock('../../client/src/components/widget-editor/utils/parseColumnsToMetadata', () => ({
  parseColumnsToMetadata: vi.fn(() => []),
}));

describe('DashboardFilterPanel', () => {
  const baseDashboard = {
    connectionId: 'conn-1',
    semanticView: 'DB.SCHEMA.VIEW',
    database: 'DB',
    schema: 'SCHEMA',
  };

  const baseProps = {
    open: true,
    onClose: vi.fn(),
    isEditMode: true,
    dashboard: baseDashboard,
    filterFields: [],
    onUpdateFilterFields: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not apply the open class when open is false', () => {
    const { container } = render(<DashboardFilterPanel {...baseProps} open={false} />);
    const panel = container.querySelector('.dashboard-filter-panel');
    expect(panel.classList.contains('open')).toBe(false);
  });

  it('applies the open class when open is true', () => {
    const { container } = render(<DashboardFilterPanel {...baseProps} />);
    const panel = container.querySelector('.dashboard-filter-panel');
    expect(panel.classList.contains('open')).toBe(true);
  });

  it('renders the panel header with title "Filters"', () => {
    render(<DashboardFilterPanel {...baseProps} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows empty state when no filter fields are configured', () => {
    render(<DashboardFilterPanel {...baseProps} filterFields={[]} />);
    expect(screen.getByText(/add fields to filter/i)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<DashboardFilterPanel {...baseProps} onClose={onClose} />);

    const closeBtn = container.querySelector('.fp-close');
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders filter field cards when filterFields are provided', () => {
    const fields = [
      { name: 'REGION', type: 'dropdown', dataType: 'VARCHAR' },
      { name: 'AMOUNT', type: 'slider', dataType: 'NUMBER' },
    ];
    render(<DashboardFilterPanel {...baseProps} filterFields={fields} />);
    expect(screen.getByText(/region/i)).toBeInTheDocument();
    expect(screen.getByText(/amount/i)).toBeInTheDocument();
  });
});
