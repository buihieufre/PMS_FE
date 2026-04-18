import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Check, ChevronsUpDown, Search, Building2, Mail, Users, UserPlus } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';

interface ManageMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  departmentId?: string; // Optional: can be used as a default
  existingMember?: any | null; // If null -> Add, If provided -> Edit
  onSuccess: () => void;
}

const ROLES = [
  { value: 'PROJECT_OWNER', label: 'Project Owner' },
  { value: 'TEAM_LEAD', label: 'Team Lead' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'FREELANCER', label: 'Freelancer' },
  { value: 'CLIENT', label: 'Client' },
];

type Tab = 'department' | 'email';

export default function ManageMemberModal({ isOpen, onClose, projectId, departmentId, existingMember, onSuccess }: ManageMemberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('department');

  // Form State
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [projectRole, setProjectRole] = useState('EMPLOYEE');

  // Data State
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departmentId || '');
  const [usersInDept, setUsersInDept] = useState<any[]>([]);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch Departments on Mount
  useEffect(() => {
    if (isOpen) {
      axiosInstance.get('/departments').then(res => {
        setDepartments(res.data);
        if (!selectedDeptId && res.data.length > 0) {
          setSelectedDeptId(res.data[0].id);
        }
      }).catch(err => console.error('Failed to fetch departments', err));
    }
  }, [isOpen]);

  // Fetch users in selected department
  useEffect(() => {
    if (isOpen && activeTab === 'department' && selectedDeptId && !existingMember) {
      setLoadingUsers(true);
      const url = `/users/available-members?projectId=${projectId}&departmentId=${selectedDeptId}`;
      axiosInstance.get(url).then(res => {
        setUsersInDept(res.data);
      }).catch(err => {
        console.warn('Cannot fetch department users');
      }).finally(() => setLoadingUsers(false));
    }
  }, [isOpen, activeTab, selectedDeptId, projectId, existingMember]);

  // Fetch global users for search (on Email tab focus or search)
  useEffect(() => {
    if (isOpen && activeTab === 'email' && !existingMember && globalUsers.length === 0) {
      setLoadingUsers(true);
      const url = `/users/available-members?projectId=${projectId}`;
      axiosInstance.get(url).then(res => {
        setGlobalUsers(res.data);
      }).catch(err => {
        console.warn('Cannot fetch global users');
      }).finally(() => setLoadingUsers(false));
    }
  }, [isOpen, activeTab, projectId, existingMember]);

  useEffect(() => {
    if (isOpen) {
      if (existingMember) {
        // Edit Mode
        setEmail(existingMember.user?.email || '');
        setDisplayName(existingMember.user?.displayName || '');
        setProjectRole(existingMember.projectRole || 'EMPLOYEE');
        setActiveTab('email'); // Default to email tab for edit (just to show identity)
      } else {
        // Add Mode
        setEmail('');
        setDisplayName('');
        setProjectRole('EMPLOYEE');
        setSearchTerm('');
        setActiveTab('department');
      }
    }
  }, [isOpen, existingMember]);

  // Click outside listener for search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !projectRole) {
      toast.error('Please select a user and a role');
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingMember) {
        await axiosInstance.patch(`/projects/${projectId}/members/${existingMember.user.id}`, {
          projectRole
        });
        toast.success('Member updated successfully');
      } else {
        await axiosInstance.post(`/projects/${projectId}/members`, {
          email,
          projectRole
        });
        toast.success('Member added successfully');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGlobalUsers = globalUsers.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 self-center">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white shadow-lg">
                {existingMember ? <Users className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800 leading-tight">
                  {existingMember ? 'Manage Role' : 'Add Team Member'}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Project Access Control</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Tab Navigation (Only for NEW members) */}
        {!existingMember && (
          <div className="px-6 pt-4">
            <div className="flex p-1 bg-slate-100 rounded-xl space-x-1">
              <button 
                onClick={() => setActiveTab('department')}
                className={`flex-1 flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'department' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Building2 className={`h-3.5 w-3.5 mr-2 ${activeTab === 'department' ? 'text-emerald-500' : ''}`} />
                By Department
              </button>
              <button 
                onClick={() => setActiveTab('email')}
                className={`flex-1 flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'email' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Mail className={`h-3.5 w-3.5 mr-2 ${activeTab === 'email' ? 'text-sky-500' : ''}`} />
                Search / Email
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-5">
           {/* Member Role Selection (Always visible) */}
           <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Assign Role</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                 {ROLES.map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setProjectRole(role.value)}
                      className={`px-3 py-2 text-[11px] font-bold rounded-lg border-2 transition-all text-left ${
                        projectRole === role.value 
                        ? 'border-slate-800 bg-slate-800 text-white' 
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {role.label}
                    </button>
                 ))}
              </div>
           </div>

           <div className="h-px bg-slate-100 w-full" />

           {/* User Selection Logic */}
           {existingMember ? (
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white shadow-sm border border-slate-200">
                    <img src={`https://ui-avatars.com/api/?name=${displayName}&background=random`} alt={displayName} />
                </div>
                <div>
                   <p className="font-bold text-slate-800">{displayName}</p>
                   <p className="text-xs text-slate-500">{email}</p>
                </div>
             </div>
           ) : (
             <div className="space-y-4 min-h-[220px]">
                {activeTab === 'department' ? (
                  <>
                    <div className="space-y-1.5">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Select Department</label>
                       <select 
                          value={selectedDeptId}
                          onChange={(e) => setSelectedDeptId(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                       >
                          <option value="">-- Choose Department --</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d._count.users})</option>
                          ))}
                       </select>
                    </div>

                    <div className="space-y-1.5">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Available Users</label>
                       <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                          {loadingUsers ? (
                            <div className="col-span-full py-8 flex flex-col items-center justify-center space-y-2 opacity-50">
                               <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                               <span className="text-[10px] font-bold text-slate-400">Loading members...</span>
                            </div>
                          ) : usersInDept.length === 0 ? (
                            <div className="col-span-full py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 font-medium italic">
                               No available users found in this department
                            </div>
                          ) : (
                            usersInDept.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setEmail(u.email);
                                  setDisplayName(u.displayName);
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                  email === u.email 
                                  ? 'border-emerald-500 bg-emerald-50/30' 
                                  : 'border-slate-50 bg-white hover:border-slate-200 shadow-sm'
                                }`}
                              >
                                <div className="flex items-center space-x-3 text-left">
                                   <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0">
                                      <img src={`https://ui-avatars.com/api/?name=${u.displayName}&background=f1f5f9`} alt={u.displayName} className="rounded-full" />
                                   </div>
                                   <div>
                                      <p className="text-xs font-bold text-slate-800">{u.displayName}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                                   </div>
                                </div>
                                {email === u.email && <Check className="h-4 w-4 text-emerald-500" />}
                              </button>
                            ))
                          )}
                       </div>
                    </div>
                  </>
                ) : (
                   <div className="space-y-4" ref={searchRef}>
                      <div className="space-y-1.5 relative">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Member Search</label>
                         <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (!isSearchOpen) setIsSearchOpen(true);
                              }}
                              onFocus={() => setIsSearchOpen(true)}
                              placeholder="Type name or email address..."
                              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
                            />
                            <button 
                              type="button" 
                              onClick={() => setIsSearchOpen(!isSearchOpen)} 
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                               <ChevronsUpDown className="h-4 w-4" />
                            </button>
                         </div>

                         {isSearchOpen && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden p-1 custom-scrollbar animate-in fade-in slide-in-from-top-2">
                               {filteredGlobalUsers.length === 0 ? (
                                  <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium italic">
                                     No matching users found
                                  </div>
                               ) : (
                                  <ul className="space-y-1">
                                     {filteredGlobalUsers.map((u) => (
                                        <li 
                                           key={u.id}
                                           onClick={() => {
                                              setEmail(u.email);
                                              setDisplayName(u.displayName);
                                              setSearchTerm(u.email);
                                              setIsSearchOpen(false);
                                           }}
                                           className={`px-3 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                                              email === u.email ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'
                                           }`}
                                        >
                                           <div className="flex items-center space-x-3">
                                              <div className={`w-8 h-8 rounded-full border ${email === u.email ? 'border-slate-700' : 'border-slate-100'}`}>
                                                 <img src={`https://ui-avatars.com/api/?name=${u.displayName}&background=random`} alt={u.displayName} className="rounded-full" />
                                              </div>
                                              <div>
                                                 <p className="text-xs font-bold">{u.displayName}</p>
                                                 <p className={`text-[10px] ${email === u.email ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                                              </div>
                                           </div>
                                           {email === u.email && <Check className="h-4 w-4" />}
                                        </li>
                                     ))}
                                  </ul>
                               )}
                            </div>
                         )}
                      </div>
                      
                      {email && (
                         <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center space-x-3">
                               <div className="p-2 bg-white rounded-lg shadow-sm border border-emerald-100">
                                  <Check className="h-4 w-4 text-emerald-500" />
                               </div>
                               <div>
                                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Selected Target</p>
                                  <p className="text-xs font-bold text-slate-800">{displayName || email}</p>
                               </div>
                            </div>
                            <button 
                               type="button" 
                               onClick={() => { setEmail(''); setDisplayName(''); setSearchTerm(''); }}
                               className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors bg-white px-2 py-1 rounded-md border border-slate-100"
                            >
                               CLEAR
                            </button>
                         </div>
                      )}
                   </div>
                )}
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-all bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md active:scale-95"
          >
            Go Back
          </button>
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting || !email}
            className="px-6 py-2 text-xs font-bold text-white bg-slate-900 border border-transparent rounded-xl shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
               <>
                 <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                 Processing...
               </>
            ) : existingMember ? 'Save Changes' : (
               <>
                 <UserPlus className="h-3.5 w-3.5 mr-2" />
                 Add to Project
               </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
