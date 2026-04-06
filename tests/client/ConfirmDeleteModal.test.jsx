import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDeleteModal from '../../client/src/components/ConfirmDeleteModal';

vi.mock('../../client/src/styles/ConfirmDeleteModal.css', () => ({}));

describe('ConfirmDeleteModal', () => {
  const defaultProps = {
    itemName: 'My Dashboard',
    itemType: 'dashboard',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders the item name and type', () => {
    render(<ConfirmDeleteModal {...defaultProps} />);
    expect(screen.getByText(/delete dashboard\?/i)).toBeInTheDocument();
    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
  });

  it('disables the delete button until the name matches', () => {
    render(<ConfirmDeleteModal {...defaultProps} />);
    const deleteBtn = screen.getByRole('button', { name: /delete dashboard/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('enables the delete button when the typed name matches exactly', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/type "My Dashboard" to confirm/i);
    await user.type(input, 'My Dashboard');

    const deleteBtn = screen.getByRole('button', { name: /delete dashboard/i });
    expect(deleteBtn).toBeEnabled();
  });

  it('calls onConfirm when delete is clicked after typing the name', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText(/type "My Dashboard" to confirm/i);
    await user.type(input, 'My Dashboard');
    await user.click(screen.getByRole('button', { name: /delete dashboard/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} onCancel={onCancel} />);

    const input = screen.getByPlaceholderText(/type "My Dashboard" to confirm/i);
    await user.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows a hint when the typed name does not match', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(/type "My Dashboard" to confirm/i);
    await user.type(input, 'wrong');

    expect(screen.getByText(/names must match exactly/i)).toBeInTheDocument();
  });

  it('displays an error message when the error prop is set', () => {
    render(<ConfirmDeleteModal {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
