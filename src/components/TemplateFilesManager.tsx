import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Save, RefreshCw, AlertCircle, Check, HelpCircle } from 'lucide-react';

export const TemplateFilesManager: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('hater.txt');
  const [templates, setTemplates] = useState<Record<string, string>>({
    'hater.txt': '',
    'lpc.txt': '',
    'mon.txt': '',
    'ment.txt': '',
    'htr.txt': ''
  });
  const [editingContent, setEditingContent] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = async () => {
    setIsFetching(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success && data.templates) {
        setTemplates(data.templates);
        setEditingContent(data.templates[activeFile] || '');
      }
    } catch (err) {
      console.error('Failed to load text templates:', err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Update editor textarea when switching active configuration file file
  useEffect(() => {
    setEditingContent(templates[activeFile] || '');
    setSaveStatus('idle');
  }, [activeFile, templates]);

  // Handle Drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Process text file reading helper
  const processTxtFile = (file: File) => {
    if (file && file.type === "text/plain" || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setEditingContent(text);
        setSaveStatus('idle');
      };
      reader.readAsText(file);
    } else {
      alert("Please upload a valid .txt plain text file.");
    }
  };

  // Handle Drop event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processTxtFile(e.dataTransfer.files[0]);
    }
  };

  // Handle manual select file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processTxtFile(e.target.files[0]);
    }
  };

  // Trigger manual select trigger clicks
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/templates/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: activeFile,
          content: editingContent
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('success');
        // Update local template memory
        setTemplates(prev => ({
          ...prev,
          [activeFile]: editingContent
        }));
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const fileDescriptions: Record<string, string> = {
    'hater.txt': 'Used by the Hater Spamer (hax / %hax start) to generate responses in loops.',
    'lpc.txt': 'Used to loop tag-based flood mentions on targeted users (.lpc command).',
    'mon.txt': 'Used by Auto-reply watch targets (monitors) to dispatch notices to chats.',
    'ment.txt': 'Used by normal tag loopers (ment start) to send recurring groups alerts.',
    'htr.txt': 'Used by the Hater Target Responder (htrTargets) to answer targets with emojis.'
  };

  const fileLabels: Record<string, string> = {
    'hater.txt': 'Hater Spammer base (hater.txt)',
    'lpc.txt': 'LPC Spammer base (lpc.txt)',
    'mon.txt': 'Monitor Notification base (mon.txt)',
    'ment.txt': 'Mentions Loop base (ment.txt)',
    'htr.txt': 'HTR Target Responder (htr.txt)'
  };

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl p-6 shadow-2xl mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#25D366]" /> Dynamic Text Templates Core Manager
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            Overwrites ephemeral filesystem text files dynamically to persist configurations across Railway server boots.
          </p>
        </div>

        <button
          onClick={fetchTemplates}
          disabled={isFetching}
          className="h-8 px-3 bg-[#0A0A0A] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Sync Cache
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left selector file sidebar */}
        <div className="space-y-2 lg:col-span-1">
          {Object.keys(TEMPLATE_FILE_PATHS_LABEL_MAP_FALLBACK).map((file) => (
            <button
              key={file}
              onClick={() => setActiveFile(file)}
              className={`w-full text-left py-2.5 px-3.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between border cursor-pointer ${
                activeFile === file
                  ? 'bg-[#25D366]/10 border-[#25D366]/40 text-[#25D366]'
                  : 'bg-[#0D0D0D] border-[#262626] hover:border-gray-500 text-zinc-400'
              }`}
            >
              <span className="truncate">{fileLabels[file] || file}</span>
              <FileText className="w-3.5 h-3.5 shrink-0 ml-1.5 opacity-80" />
            </button>
          ))}
        </div>

        {/* Right workspace uploader area */}
        <div className="lg:col-span-3 space-y-4">
          {/* File purpose alert */}
          <div className="bg-[#0D0D0D] border border-[#262626] p-3 rounded-lg flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400 leading-none">Purpose</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">
                {fileDescriptions[activeFile]} Input one phrase per line. Empty lines are ignored.
              </p>
            </div>
          </div>

          {/* Text Editor Area */}
          <div className="relative">
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="Enter template phrases list (one sentence/phrase per line)..."
              rows={8}
              className="w-full text-xs font-mono bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 text-slate-300 outline-none focus:border-gray-500 transition-colors resize-y leading-relaxed"
            />

            {/* Drag & Drop Overlay */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`absolute inset-0 bg-[#0A0A0A]/95 border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-4 transition-all ${
                dragActive
                  ? 'border-[#25D366] text-[#25D366] opacity-100 scale-100'
                  : 'border-zinc-800 text-zinc-500 opacity-0 pointer-events-none scale-95'
              }`}
            >
              <Upload className="w-8 h-8 mb-2 animate-bounce" />
              <p className="text-xs font-semibold">Drop your .txt configuration file here</p>
              <p className="text-[10px] mt-1 text-zinc-500">or click to manually select from computer</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerFileSelect}
                className="h-9 px-4.5 bg-[#0D0D0D] border border-[#262626] hover:border-zinc-500 text-xs font-semibold text-slate-300 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" /> Upload File (.txt)
              </button>
              
              <p className="text-[10px] text-zinc-500 italic max-sm:hidden">
                Drag-and-drop onto editor area works too!
              </p>
            </div>

            <div className="flex items-center gap-3">
              {saveStatus === 'success' && (
                <span className="text-[11px] text-[#25D366] font-semibold flex items-center gap-1 font-mono transition-opacity">
                  <Check className="w-4 h-4 text-[#25D366]" /> SAVED AND PERSISTED SUCCESSFULLY!
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-[11px] text-red-500 font-semibold flex items-center gap-1 font-mono">
                  <AlertCircle className="w-4 h-4 text-red-500" /> OVERWRITE ACTION FAILED!
                </span>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-9 px-6 bg-[#25D366] hover:bg-opacity-95 text-black rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#25D366]/5 transition-all"
              >
                {isSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save Overwrites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TEMPLATE_FILE_PATHS_LABEL_MAP_FALLBACK = {
  'hater.txt': 1,
  'lpc.txt': 2,
  'mon.txt': 3,
  'ment.txt': 4,
  'htr.txt': 5
};
