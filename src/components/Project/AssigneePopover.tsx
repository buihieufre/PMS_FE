import React, { Fragment, useState } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Check, X, Search, User } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface Member {
  id: string; // The userId usually
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

interface AssigneePopoverProps {
  projectId: string;
  taskId?: string;
  projectMembers: Member[];
  selectedAssignees: any[];
  onUpdate: (newAssigneeIds: string[], updatedAssignees: any[]) => void;
}

export default function AssigneePopover({ projectId, taskId, projectMembers, selectedAssignees, onUpdate }: AssigneePopoverProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleToggleAssignee = (member: Member) => {
    const isSelected = selectedAssignees.some(a => a.id === member.user.id);
    const newAssigneeIds = isSelected 
      ? selectedAssignees.filter(a => a.id !== member.user.id).map(a => a.id)
      : [...selectedAssignees.map(a => a.id), member.user.id];

    const updatedAssignees = isSelected
      ? selectedAssignees.filter(a => a.id !== member.user.id)
      : [...selectedAssignees, member.user];
      
    // Let parent handle socket emit!
    onUpdate(newAssigneeIds, updatedAssignees);
  };

  const filteredMembers = projectMembers.filter(m => 
    m.user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover className="relative inline-block text-left">
      <Popover.Button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-md transition-colors flex items-center gap-2">
        <User className="h-4 w-4" /> Thành viên
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
        <Popover.Panel className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl ring-1 ring-slate-200 p-3 transform -translate-x-1/2 left-1/2 sm:translate-x-0 sm:left-0 focus:outline-none">
          {({ close }) => (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700 text-center flex-1">Thành viên</span>
                <button onClick={() => close()} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-2 top-2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Tìm thành viên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-xs font-semibold text-slate-500 mb-2">Thành viên dự án</div>
              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {filteredMembers.map((member) => {
                  const isSelected = selectedAssignees.some(a => a.id === member.user.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => handleToggleAssignee(member)}
                      className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {member.user.avatarUrl ? (
                            <img src={member.user.avatarUrl} alt={member.user.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.displayName)}&background=random`} alt={member.user.displayName} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{member.user.displayName}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-4">Không tìm thấy thành viên</p>
                )}
              </div>
            </div>
          )}
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
