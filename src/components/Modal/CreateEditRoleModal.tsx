import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface CreateEditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleToEdit: any;
  permissionsGrouped: { [group: string]: { action: string; description: string }[] };
  onSuccess: () => void;
}

export default function CreateEditRoleModal({ isOpen, onClose, roleToEdit, permissionsGrouped, onSuccess }: CreateEditRoleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (roleToEdit) {
      setName(roleToEdit.name);
      setDescription(roleToEdit.description || '');
      setSelectedPermissions(roleToEdit.permissions || []);
    } else {
      setName('');
      setDescription('');
      setSelectedPermissions([]);
    }
  }, [roleToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCheckboxToggle = (action: string) => {
    setSelectedPermissions((prev) => 
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const handleToggleGroup = (groupActionArray: { action: string }[]) => {
    const groupActions = groupActionArray.map((p) => p.action);
    const allSelected = groupActions.every((a) => selectedPermissions.includes(a));
    
    if (allSelected) {
      // Remove all
      setSelectedPermissions((prev) => prev.filter((a) => !groupActions.includes(a)));
    } else {
      // Add all missing
      setSelectedPermissions((prev) => {
        const set = new Set([...prev, ...groupActions]);
        return Array.from(set);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const payload = { name, description, permissions: selectedPermissions };
      if (roleToEdit) {
        await axiosInstance.patch(`/roles/${roleToEdit.id}`, payload);
        toast.success('Role updated successfully');
      } else {
        await axiosInstance.post(`/roles`, payload);
        toast.success('Role created successfully');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{roleToEdit ? 'Edit Role' : 'Create New Role'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form id="roleForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 mb-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Content Manager"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this role"
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="mb-4 space-y-6">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Permissions Configuration</h3>
            {Object.entries(permissionsGrouped).map(([group, perms]) => {
              const groupActions = perms.map((p) => p.action);
              const isAllChecked = groupActions.every((a) => selectedPermissions.includes(a));
              const isSomeChecked = groupActions.some((a) => selectedPermissions.includes(a)) && !isAllChecked;

              return (
                <div key={group} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                    <label className="flex items-center cursor-pointer font-medium text-slate-800 capitalize text-sm">
                      <input 
                        type="checkbox"
                        checked={isAllChecked}
                        ref={(el) => { if (el) el.indeterminate = isSomeChecked; }}
                        onChange={() => handleToggleGroup(perms)}
                        className="mr-2 h-4 w-4 text-slate-900 focus:ring-slate-900 border-gray-300 rounded"
                      />
                      {group} Module
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                    {perms.map((p) => (
                      <label key={p.action} className="flex items-start text-sm text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(p.action)}
                          onChange={() => handleCheckboxToggle(p.action)}
                          className="mt-0.5 mr-2 h-4 w-4 text-slate-900 focus:ring-slate-900 border-gray-300 rounded"
                        />
                        <span>
                          <span className="block font-medium text-slate-700">{p.action}</span>
                          <span className="block text-xs text-slate-400 mt-0.5">{p.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </form>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 flex-shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="roleForm"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 border border-transparent rounded-md hover:bg-slate-800 transition-colors flex items-center disabled:opacity-70"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {roleToEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
}
