import React, { useState, useRef, Fragment } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Paperclip, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/lib/axios';

interface AttachmentPopoverProps {
  projectId: string;
  taskId: string;
  onUpdate: () => void;
}

export default function AttachmentPopover({ projectId, taskId, onUpdate }: AttachmentPopoverProps) {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isServerProcessing, setIsServerProcessing] = useState(false);
  const [link, setLink] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Dung lượng tệp tối đa là 50MB');
        return;
      }
      setSelectedFile(file);
      if (!displayText) setDisplayText(file.name);
    }
  };

  const resetForm = () => {
    setLink('');
    setDisplayText('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAttach = async (close: () => void) => {
    if (!selectedFile && !link.trim()) {
      toast.error('Vui lòng chọn tệp hoặc nhập liên kết');
      return;
    }

    setLoading(true);
    setIsServerProcessing(false);
    setUploadProgress(selectedFile ? 0 : 35);
    try {
      const formData = new FormData();
      const hasFile = Boolean(selectedFile);

      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (link.trim()) {
        formData.append('link', link.trim());
      }
      if (displayText.trim()) {
        formData.append('fileName', displayText.trim());
      }

      await axiosInstance.post(`/projects/${projectId}/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: hasFile
          ? (progressEvent) => {
              if (!progressEvent.total) return;
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              setUploadProgress(Math.min(percent, 95));
              if (percent >= 95) {
                setIsServerProcessing(true);
              }
            }
          : undefined
      });

      setUploadProgress(100);
      toast.success('Đã đính kèm thành công');
      onUpdate();
      resetForm();
      close();
    } catch (error: any) {
      console.error('Attachment error:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi đính kèm');
    } finally {
      setLoading(false);
      setIsServerProcessing(false);
      setUploadProgress(0);
    }
  };

  return (
    <Popover className="relative">
      {({ open, close }) => (
        <>
          <Popover.Button className="w-full px-4 py-3 bg-white border border-slate-100 hover:bg-slate-50 rounded-2xl text-xs font-black flex items-center transition-all shadow-lg shadow-slate-100/50 text-slate-600">
            <Paperclip className="h-4 w-4 mr-3 text-slate-400" /> Đính kèm tệp
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
            <Popover.Panel className="absolute z-[110] right-0 mt-2 w-[320px] bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] ring-1 ring-slate-200 p-4 focus:outline-none">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-bold text-slate-700 text-center flex-1">Đính kèm</span>
                <button onClick={() => close()} disabled={loading} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {loading && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isServerProcessing ? 'Đang xử lý tệp trên máy chủ...' : 'Đang tải tệp lên...'}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* File Upload Section */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Đính kèm tệp từ máy tính của bạn</h4>
                  <p className="text-[11px] text-slate-400 mb-3">Bạn cũng có thể kéo và thả tệp để tải chúng lên.</p>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {selectedFile ? selectedFile.name : 'Chọn tệp'}
                  </button>
                  {selectedFile && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Dung lượng: {formatSize(selectedFile.size)}
                    </p>
                  )}
                </div>

                <div className="h-px bg-slate-100" />

                {/* Link Section */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tìm kiếm hoặc dán liên kết <span className="text-rose-500">*</span></h4>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Tìm các liên kết gần đây hoặc dán một liên kết..."
                      value={link}
                      disabled={loading}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                {/* Display Text Section */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Văn bản hiển thị (không bắt buộc)</h4>
                  <input 
                    type="text"
                    placeholder="Văn bản cần hiển thị"
                    value={displayText}
                      disabled={loading}
                    onChange={(e) => setDisplayText(e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Cung cấp tiêu đề hoặc mô tả cho liên kết này</p>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    disabled={loading}
                    onClick={() => { resetForm(); close(); }}
                    className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-all disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => handleAttach(close)}
                    disabled={loading || (!selectedFile && !link.trim())}
                    className="px-4 py-1.5 bg-[#0c66e4] hover:bg-[#0055cc] disabled:bg-slate-300 text-white text-xs font-bold rounded-md transition-all shadow-sm inline-flex items-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isServerProcessing ? 'Đang xử lý...' : `Đang tải ${uploadProgress}%`}
                      </>
                    ) : (
                      'Chèn'
                    )}
                  </button>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
