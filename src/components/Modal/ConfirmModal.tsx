import { Dialog, Transition } from '@headlessui/react';
import { Fragment, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = hành động gỡ/xóa (mặc định), primary = xác nhận thông thường */
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = 'Bạn có chắc chắn?',
  description = 'Hành động này có thể không hoàn tác.',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const handleClose = () => {
    if (!isLoading) onCancel();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-hidden />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={clsx(
                  'w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 text-left align-middle shadow-2xl shadow-slate-900/10',
                  'ring-1 ring-slate-900/5 transition-all'
                )}
              >
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold leading-6 text-slate-900 tracking-tight"
                >
                  {title}
                </Dialog.Title>
                {description != null && description !== '' && (
                  <div className="mt-3 text-sm leading-relaxed text-slate-600">{description}</div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full sm:w-auto justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                      variant === 'danger'
                        ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500'
                    )}
                    onClick={() => void onConfirm()}
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                    {confirmLabel}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
