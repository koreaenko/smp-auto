'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Slide {
  slide_number: number;
  type: string;
  description: string;
  prompt: string;
}

interface ContentLog {
  id: string;
  created_at: string;
  content_type: 'auto' | 'vision';
  target_gender: string;
  concept: string;
  prompts: Slide[];
  caption: string;
  hashtags: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  image_urls: string[];
}

export default function Home() {
  const [logs, setLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAuto, setGeneratingAuto] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  
  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  
  // Status message state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carousel slide view state per post ID
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchLogs();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/content');
      const json = await res.json();
      if (json.ok) {
        setLogs(json.data);
      } else {
        showToast('데이터를 불러오지 못했습니다: ' + json.error, 'error');
      }
    } catch (err: any) {
      showToast('API 연결 에러: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual auto content generation
  const handleGenerateAuto = async () => {
    if (generatingAuto || analyzingImage) return;
    setGeneratingAuto(true);
    showToast('AI 콘텐츠 기획을 시작합니다. 잠시만 기다려주세요...', 'info');
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'auto' }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('새로운 인스타 콘텐츠가 기획되었습니다! Telegram 봇으로도 발송되었습니다.', 'success');
        fetchLogs();
      } else {
        showToast('생성 실패: ' + json.error, 'error');
      }
    } catch (err: any) {
      showToast('네트워크 오류: ' + err.message, 'error');
    } finally {
      setGeneratingAuto(false);
    }
  };

  // Trigger manual Vision content generation from uploaded image
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPhoto(file);
    }
  };

  const processPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
      return;
    }

    setAnalyzingImage(true);
    showToast('OpenAI Vision API로 두피 이미지를 분석하는 중입니다... ☕', 'info');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'vision', image: base64String }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('두피 분석 및 콘텐츠 기획이 성공적으로 완료되었습니다!', 'success');
          fetchLogs();
        } else {
          showToast('분석 실패: ' + json.error, 'error');
        }
      } catch (err: any) {
        showToast('네트워크 오류: ' + err.message, 'error');
      } finally {
        setAnalyzingImage(false);
      }
    };
    reader.onerror = () => {
      showToast('파일 읽기 오류가 발생했습니다.', 'error');
      setAnalyzingImage(false);
    };
  };

  // Approve a draft
  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: 'approved' }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('콘텐츠 승인이 완료되었습니다. 👍');
        setLogs(logs.map(log => log.id === id ? { ...log, approval_status: 'approved' } : log));
      } else {
        showToast('승인 처리 실패: ' + json.error, 'error');
      }
    } catch (err: any) {
      showToast('오류 발생: ' + err.message, 'error');
    }
  };

  // Delete a content log
  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 콘텐츠 기획안을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.ok) {
        showToast('삭제되었습니다.');
        setLogs(logs.filter(log => log.id !== id));
      } else {
        showToast('삭제 실패: ' + json.error, 'error');
      }
    } catch (err: any) {
      showToast('오류 발생: ' + err.message, 'error');
    }
  };

  // Save inline edits
  const handleSaveEdits = async (id: string) => {
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: editCaption, hashtags: editHashtags }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('수정 내용이 저장되었습니다. 💾');
        setLogs(logs.map(log => log.id === id ? { ...log, caption: editCaption, hashtags: editHashtags } : log));
        setEditingId(null);
      } else {
        showToast('저장 실패: ' + json.error, 'error');
      }
    } catch (err: any) {
      showToast('오류 발생: ' + err.message, 'error');
    }
  };

  // Copy text helper
  const copyToClipboard = (text: string, typeName: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${typeName}이 클립보드에 복사되었습니다! 📋`, 'success');
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processPhoto(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-slate-100 font-sans relative overflow-x-hidden pb-16">
      
      {/* Decorative premium gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-amber-500/10 to-indigo-500/0 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-indigo-500/10 to-amber-500/0 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Container */}
      <header className="border-b border-slate-800 bg-[#0d0e12]/80 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-black text-xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              S
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-slate-100 bg-clip-text text-transparent">
                Premium SMP Studio
              </h1>
              <p className="text-xs text-slate-500 font-mono">INSTAGRAM CONTENT AI AGENT</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="https://t.me" 
              target="_blank" 
              className="text-xs px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 transition duration-200 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.97-.74 3.79-1.65 6.32-2.74 7.59-3.27 3.6-1.5 4.35-1.76 4.84-1.77.11 0 .35.03.51.16.13.1.17.24.19.34.02.09.02.26.01.35z"/>
              </svg>
              Telegram 연결됨
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Action panel (Width: 4/12) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Stats Card */}
          <div className="border border-slate-800 bg-slate-900/30 backdrop-blur-lg rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400 font-mono">브랜드 방향성 가이드</h2>
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>여성 정수리 가르마 밀도보강 집중</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>자연광 아래 모공/피부 질감 극사실주의</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>모발이식 느낌 금지, 자연스러운 도트</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>30대~50대 한국 여성을 공감하는 화법</span>
              </div>
            </div>
            <div className="h-px bg-slate-800 w-full my-1" />
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>여성 타겟 권장 비율</span>
              <span className="font-mono text-amber-500 font-bold">75% ~ 80%</span>
            </div>
          </div>

          {/* Action Trigger Card */}
          <div className="border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-900/20 backdrop-blur-lg rounded-2xl p-6 flex flex-col gap-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
            <div>
              <h2 className="text-base font-bold text-slate-100">새로운 인스타 콘텐츠 제작</h2>
              <p className="text-xs text-slate-400 mt-1">
                오전 9시 크론 실행 외에도 언제든 수동으로 AI 기획안을 도출할 수 있습니다.
              </p>
            </div>

            {/* AI Auto Trigger Button */}
            <button
              onClick={handleGenerateAuto}
              disabled={generatingAuto || analyzingImage}
              className="relative w-full h-14 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-black font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(245,158,11,0.15)] group"
            >
              {generatingAuto ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI 기획 구성중...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>🤖 AI가 알아서 피드 만들기</span>
                </>
              )}
            </button>

            <div className="flex items-center my-1">
              <div className="h-px bg-slate-800 flex-grow" />
              <span className="text-[10px] text-slate-500 uppercase px-3 tracking-wider font-mono">OR upload photo</span>
              <div className="h-px bg-slate-800 flex-grow" />
            </div>

            {/* Vision Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition duration-300 flex flex-col items-center justify-center gap-3 ${
                dragOver 
                  ? 'border-amber-500 bg-amber-500/5' 
                  : 'border-slate-800 hover:border-amber-500/40 bg-slate-900/20 hover:bg-slate-900/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
                disabled={generatingAuto || analyzingImage}
              />
              
              {analyzingImage ? (
                <div className="py-2 flex flex-col items-center gap-2">
                  <svg className="animate-spin h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-xs font-mono text-amber-500 font-semibold mt-1">Scalp Vision Analyzing...</p>
                </div>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300">📸 두피/시술 사진 첨부해서 기획하기</p>
                    <p className="text-[10px] text-slate-500 mt-1">드래그 앤 드롭 또는 클릭하여 파일 선택</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right column: Content Logs (Width: 8/12) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
              📂 기획 보관함 및 승인 로그
              <span className="text-xs font-normal font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {logs.length} Posts
              </span>
            </h2>
            <button 
              onClick={fetchLogs}
              className="text-xs p-2 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition duration-200"
              title="새로고침"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="border border-slate-800 bg-slate-900/10 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-xs text-slate-500 font-mono">Connecting to Supabase...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="border border-slate-800 bg-slate-900/10 rounded-2xl p-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-400">아직 기획된 콘텐츠가 없습니다.</p>
                <p className="text-xs text-slate-600 mt-1">상단 버튼을 누르거나 텔레그램을 연동하여 첫 콘텐츠를 발행해보세요.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {logs.map((log) => {
                const activeIndex = carouselIndices[log.id] || 0;
                const isApproved = log.approval_status === 'approved';
                const isEditing = editingId === log.id;

                return (
                  <article 
                    key={log.id} 
                    className={`border rounded-2xl bg-slate-950 overflow-hidden shadow-xl transition-all duration-300 ${
                      isApproved 
                        ? 'border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.02)]' 
                        : 'border-slate-800'
                    }`}
                  >
                    
                    {/* Log Header */}
                    <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-900 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold font-mono ${
                          log.content_type === 'vision' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {log.content_type === 'vision' ? '📸 VISION 분석' : '🤖 AI 자동기획'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold font-mono">
                          {log.target_gender} SMP
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleDateString('ko-KR', {
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Status Badges */}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                        isApproved ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isApproved ? 'bg-black' : 'bg-slate-500'}`} />
                        {isApproved ? '최종 승인됨' : '승인 대기중'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12">
                      
                      {/* Left: Instagram Carousel Mockup (Width: 5/12) */}
                      <div className="md:col-span-5 bg-black border-r border-slate-900 relative aspect-square flex flex-col justify-between">
                        
                        {/* Slide Navigation Header */}
                        <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center text-xs text-slate-200">
                          <span className="font-semibold bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm border border-slate-800">
                            {log.prompts[activeIndex]?.type}
                          </span>
                          <span className="font-mono bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm border border-slate-800">
                            {activeIndex + 1} / {log.prompts.length}
                          </span>
                        </div>

                        {/* Image display */}
                        <div className="w-full h-full relative overflow-hidden group">
                          {log.image_urls && log.image_urls[activeIndex] ? (
                            <img 
                              src={log.image_urls[activeIndex]} 
                              alt={`Slide ${activeIndex + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600 font-mono text-xs">
                              No image generated
                            </div>
                          )}

                          {/* Hover Prompt Info Overlay */}
                          <div className="absolute inset-0 bg-slate-950/90 p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end gap-2.5 overflow-y-auto">
                            <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold font-mono">Generated Image Prompt</span>
                            <p className="text-xs text-slate-200 italic leading-relaxed">
                              &ldquo;{log.prompts[activeIndex]?.prompt}&rdquo;
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(log.prompts[activeIndex]?.prompt || '', '이미지 생성 프롬프트');
                              }}
                              className="text-[10px] self-start py-1 px-2.5 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
                            >
                              프롬프트 복사
                            </button>
                          </div>
                        </div>

                        {/* Slide indicator dots */}
                        <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 z-10 pointer-events-none">
                          {log.prompts.map((_, idx) => (
                            <span 
                              key={idx}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === activeIndex ? 'w-4 bg-amber-500' : 'w-1.5 bg-white/40'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Navigation Arrows */}
                        <button
                          onClick={() => {
                            const newIdx = activeIndex === 0 ? log.prompts.length - 1 : activeIndex - 1;
                            setCarouselIndices({ ...carouselIndices, [log.id]: newIdx });
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/90 active:scale-95 transition z-10"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => {
                            const newIdx = activeIndex === log.prompts.length - 1 ? 0 : activeIndex + 1;
                            setCarouselIndices({ ...carouselIndices, [log.id]: newIdx });
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/90 active:scale-95 transition z-10"
                        >
                          ›
                        </button>
                      </div>

                      {/* Right: Concept, Captions and Actions (Width: 7/12) */}
                      <div className="md:col-span-7 p-6 flex flex-col justify-between gap-5 bg-slate-950">
                        <div className="flex flex-col gap-4">
                          <div>
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Concept Title</span>
                            <h3 className="text-base font-bold text-slate-100 mt-0.5">{log.concept}</h3>
                            <p className="text-xs text-slate-400 italic mt-1 leading-relaxed">
                              🔍 {log.prompts[activeIndex]?.description}
                            </p>
                          </div>

                          <div className="h-px bg-slate-900 w-full" />

                          {/* Editable or Static Caption display */}
                          {isEditing ? (
                            <div className="flex flex-col gap-3">
                              <div>
                                <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Edit Caption</label>
                                <textarea
                                  value={editCaption}
                                  onChange={(e) => setEditCaption(e.target.value)}
                                  className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none font-sans"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Edit Hashtags</label>
                                <input
                                  type="text"
                                  value={editHashtags}
                                  onChange={(e) => setEditHashtags(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 font-sans"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4">
                              {/* Caption Box */}
                              <div className="relative group/copy bg-slate-900/30 border border-slate-900 rounded-xl p-4">
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Instagram Caption</span>
                                <pre className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap max-h-36 overflow-y-auto select-text pr-8">
                                  {log.caption}
                                </pre>
                                <button
                                  onClick={() => copyToClipboard(log.caption, '인스타그램 캡션')}
                                  className="absolute top-3 right-3 opacity-0 group-hover/copy:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                  title="캡션 복사"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </div>

                              {/* Hashtags Box */}
                              <div className="relative group/tags bg-slate-900/30 border border-slate-900 rounded-xl p-4">
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Hashtags</span>
                                <p className="text-xs text-amber-500/90 leading-relaxed select-text font-sans break-all pr-8">
                                  {log.hashtags}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(log.hashtags, '해시태그')}
                                  className="absolute top-3 right-3 opacity-0 group-hover/tags:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                  title="해시태그 복사"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card Actions Footer */}
                        <div className="flex items-center justify-between border-t border-slate-900 pt-4 mt-1">
                          
                          {/* Left action (Delete) */}
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-2 text-slate-600 hover:text-rose-500 transition duration-200 rounded-lg hover:bg-rose-500/5"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          {/* Right action group */}
                          <div className="flex items-center gap-3">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition duration-200"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={() => handleSaveEdits(log.id)}
                                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition duration-200"
                                >
                                  저장
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingId(log.id);
                                    setEditCaption(log.caption);
                                    setEditHashtags(log.hashtags);
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 text-xs transition duration-200 flex items-center gap-1.5"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M18.364 4.982a8.282 8.282 0 00-11.716 0l-3.536 3.536L2 13l2.482-.018 3.536-3.536a8.282 8.282 0 000-11.716L18.364 4.982z" />
                                  </svg>
                                  수정하기
                                </button>
                                
                                {!isApproved && (
                                  <button
                                    onClick={() => handleApprove(log.id)}
                                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition duration-200 flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    최종 승인
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                  </article>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Modern floating toast message */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 z-50 text-xs font-semibold flex items-center gap-2.5 ${
          toast.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' 
            : toast.type === 'info'
            ? 'bg-slate-900/90 border-amber-500/30 text-amber-200'
            : 'bg-slate-950/90 border-amber-500/40 text-slate-100 shadow-[0_4px_30px_rgba(245,158,11,0.15)]'
        }`}>
          {toast.type === 'error' ? (
            <span className="text-base">⚠️</span>
          ) : toast.type === 'info' ? (
            <span className="animate-bounce">☕</span>
          ) : (
            <span className="text-base">✨</span>
          )}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
