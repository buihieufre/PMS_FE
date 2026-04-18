import React, { Fragment, useState } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { CheckSquare, X } from 'lucide-react';

interface ChecklistPopoverProps {
  onAdd: (title: string) => void;
}

export default function ChecklistPopover({ onAdd }: ChecklistPopoverProps) {
  const [title, setTitle] = useState('');

  const handleAdd = (close: () => void) => {
    if (!title.trim()) return;
    onAdd(title);
    setTitle('');
    close();
  };

  return (
    <Popover className="relative w-full text-left">
      <Popover.Button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 rounded-2xl text-xs font-black flex items-center transition-all shadow-lg shadow-slate-100/50 text-slate-600">
        <CheckSquare className="h-4 w-4 mr-3 text-indigo-500" /> Việc cần làm
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl ring-1 ring-slate-200 p-3 left-0 focus:outline-none">
          {({ close }) => (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-slate-700 w-full text-center">Thêm danh sách công việc</span>
                <button onClick={() => close()} className="text-slate-400 hover:text-slate-600 absolute right-3">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề</label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Checklist công việc hôm nay"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-800"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd(close);
                    }}
                    autoFocus
                  />
                </div>

                <button 
                  onClick={() => handleAdd(close)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm transition-colors"
                >
                  Thêm
                </button>
              </div>
            </div>
          )}
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
