import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { useAppContext } from '../context/AppContext';
import { mathEngine, MathResult } from '../services/local_parser/mathEngine';
import { geminiService } from '../services/ai/geminiService';
import { 
  ArrowLeft, 
  Trash, 
  Trash2,
  Sparkles, 
  BrainCircuit, 
  Camera, 
  X,
  Check, 
  Cloud,
  Loader2,
  CreditCard,
  Sun,
  Moon,
  AlignLeft,
  Wand2,
  Minimize2,
  Maximize2,
  PenTool,
  CheckSquare,
  Languages,
  LayoutTemplate,
  Type, 
  AlignCenter, 
  AlignRight,
  Palette,
  Bold,
  Italic,
  Underline,
  ChevronLeft,
  ALargeSmall,
  Baseline
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

export const NoteEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, login, tokenStatus, refreshTokens, notes } = useAppContext();
  
  // Find initial data from notes list if possible to prevent UI flicker
  const initialNote = notes.find(n => n.id === id);
  
  const [title, setTitle] = useState(initialNote?.title || '');
  const [content, setContent] = useState(initialNote?.content || '');
  const [mathResults, setMathResults] = useState<MathResult[]>([]);
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSmartCompose, setShowSmartCompose] = useState(false);
  const [smartComposePrompt, setSmartComposePrompt] = useState('');
  
  // Formatter State
  const [showFormatter, setShowFormatter] = useState(false);
  const [activeFormatterMenu, setActiveFormatterMenu] = useState<'main' | 'fontFamily' | 'fontSize' | 'textAlign'>('main');
  const [formatterSettings, setFormatterSettings] = useState({
    fontFamily: 'font-mono',
    fontSize: 'text-lg',
    textAlign: 'text-left'
  });

  // New States for AI Selection Feature
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [selectionPos, setSelectionPos] = useState({ top: 0 });
  const [showSelectionAI, setShowSelectionAI] = useState(false);
  const [selectionAIPrompt, setSelectionAIPrompt] = useState('');
  
  const [aiLoading, setAiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Sync with Firestore for latest updates (still useful if local data is stale)
  useEffect(() => {
    if (id && id !== 'new' && user) {
      if (initialNote && !isDirty) {
        // If we switched notes and the state wasn't updated yet or if data synced
        setTitle(initialNote.title);
        setContent(initialNote.content);
        return;
      }
      
      // Fallback: If not in local cache, load from DB
      if (!initialNote && !isDirty) {
        const load = async () => {
          const snap = await getDoc(doc(db, 'notes', id));
          if (snap.exists()) {
            const data = snap.data();
            setTitle(data.title);
            setContent(data.content);
            setTimeout(() => setIsDirty(false), 50); 
          }
        };
        load();
      }
    }
  }, [id, user, !!initialNote]); 

  // Math Reactive Engine
  useEffect(() => {
    const results = mathEngine.process(content);
    setMathResults(results);

    // Auto-resize textarea
    if (editorRef.current) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
    }
  }, [content]);

  // Handle Input Changes
  const handleTitleChange = (val: string) => {
    setTitle(val);
    setIsDirty(true);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    setIsDirty(true);
  };

  const applyMarkdown = (syntax: string) => {
    if (!editorRef.current) return;
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);
    
    let newContent = '';
    let newStart = 0;
    let newEnd = 0;

    if (before.endsWith(syntax) && after.startsWith(syntax)) {
      // Unwrap
      newContent = before.slice(0, -syntax.length) + selectedText + after.slice(syntax.length);
      newStart = start - syntax.length;
      newEnd = end - syntax.length;
    } else {
      // Wrap
      newContent = `${before}${syntax}${selectedText}${syntax}${after}`;
      newStart = start + syntax.length;
      newEnd = end + syntax.length;
    }
    
    setContent(newContent);
    setIsDirty(true);
    
    // Restore focus and selection
    setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  // Auto-save logic
  useEffect(() => {
    if (!isDirty || !user) return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const noteData = {
          title: title || 'Untitled',
          content,
          userId: user.uid,
          updatedAt: serverTimestamp(),
        };

        if (id === 'new') {
          const newRef = doc(collection(db, 'notes'));
          await setDoc(newRef, noteData);
          navigate(`/note/${newRef.id}`, { replace: true });
        } else if (id) {
          await updateDoc(doc(db, 'notes', id), noteData);
        }
        setSaveStatus('saved');
        setIsDirty(false);
      } catch (e) {
        console.error(e);
        setSaveStatus('error');
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [title, content, isDirty, user, id, navigate]);

  const confirmDelete = async () => {
    if (id && id !== 'new') {
      if (window.confirm("Delete this note?")) {
        await deleteDoc(doc(db, 'notes', id));
        navigate('/', { replace: true });
      }
    }
  };

  const handleAIAction = async (action: 'general' | 'math' | 'ocr') => {
    if (!user) {
      login();
      return;
    }
    if (!tokenStatus?.canUseAI) {
      alert("No tokens remaining. Wait for reset.");
      return;
    }

    setAiLoading(true);
    try {
      let res = '';
      const promptContext = `Please provide a response in plain text only. Do NOT use markdown formatting like asterisks (**), hashtags (###), or list symbols (-) unless they are intended to be plain text content. Keep it clean and mobile-friendly.`;
      
      if (action === 'general') {
        const prompt = smartComposePrompt || `Refine this note or add brief insights.`;
        res = await geminiService.generateContent(`${prompt}. ${promptContext}\nCurrent note content: "${content}"`) || '';
      } else if (action === 'math') {
        res = await geminiService.parseComplexMath(content) || '';
      } else if (action === 'ocr') {
        res = "lunch = 15.00\ndrinks = 5.00\ntotal = lunch + drinks =";
      }

      if (res) {
        // Clean up any remaining markdown if the model ignored instructions
        const cleanRes = res.replace(/\*\*/g, '').replace(/###/g, '').trim();
        setContent(prev => prev + (prev ? "\n\n" : "") + cleanRes);
        // Reset Smart Compose
        setSmartComposePrompt('');
        setShowSmartCompose(false);
        setIsDirty(true);
      }
      refreshTokens();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAiLoading(false);
      setShowAIModal(false);
    }
  };

  const handleAISelectionAction = async (actionType: string) => {
    if (!user) { login(); return; }
    if (!tokenStatus?.canUseAI) { alert("No tokens remaining."); return; }
    if (!selection) return;

    setAiLoading(true);
    try {
      let prompt = '';
      const contextInstruct = `You are a helpful AI writing assistant. Provide your response in plain text without markdown formatting. Below is the selected text you need to process:\n\n"${selection.text}"\n\n`;
      
      switch (actionType) {
        case 'summary': prompt = `${contextInstruct}Provide a concise summary.`; break;
        case 'polish': prompt = `${contextInstruct}Polish this text, improving style and vocabulary while keeping the original meaning.`; break;
        case 'shorten': prompt = `${contextInstruct}Make this text shorter and more concise.`; break;
        case 'extend': prompt = `${contextInstruct}Extend this text, adding relevant details and elaborating on the points.`; break;
        case 'continue': prompt = `${contextInstruct}Continue writing from where this text leaves off, matching the tone and style.`; break;
        case 'grammar': prompt = `${contextInstruct}Correct any grammar, spelling, or punctuation errors in this text.`; break;
        case 'layout': prompt = `${contextInstruct}Format and structure this text with a smart layout, using line breaks and clear spacing.`; break;
        case 'todos': prompt = `${contextInstruct}Extract all actionable tasks or to-dos from this text into a simple bulleted list.`; break;
        case 'translate': prompt = `${contextInstruct}Translate this text into English (or if it is already English, translate it to Indonesian).`; break;
        case 'custom': prompt = `${contextInstruct}Follow this instruction: ${selectionAIPrompt}`; break;
      }

      const res = await geminiService.generateContent(prompt) || '';
      
      if (res) {
        const cleanRes = res.replace(/\*\*/g, '').replace(/###/g, '').trim();
        
        let newContent = content;
        if (actionType === 'summary' || actionType === 'todos') {
          // Append below selection
          newContent = content.substring(0, selection.end) + `\n\n[AI]: ${cleanRes}\n` + content.substring(selection.end);
        } else if (actionType === 'continue') {
          // Append directly at the end of selection
          newContent = content.substring(0, selection.end) + ` ${cleanRes}` + content.substring(selection.end);
        } else {
          // Replace selection
          newContent = content.substring(0, selection.start) + cleanRes + content.substring(selection.end);
        }

        setContent(newContent);
        setSelection(null);
        setShowSelectionAI(false);
        setSelectionAIPrompt('');
        setIsDirty(true);
      }
      refreshTokens();
    } catch(e: any) {
      alert(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <motion.div 
        layoutId={id ? `note-${id}` : undefined}
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(40px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.8, filter: 'blur(40px)' }}
        transition={{ 
          type: "spring", 
          stiffness: 450, 
          damping: 32,
          mass: 1,
          layout: { 
            type: "spring", 
            stiffness: 450, 
            damping: 32 
          }
        }}
        className="min-h-screen pt-16 px-6 pb-40 overflow-x-hidden"
      >
        {/* Navbar */}
        <div className="flex items-center justify-between mb-10 max-w-3xl mx-auto">
        <button 
          onClick={() => navigate('/')} 
          className="w-12 h-12 glass rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && (
              <motion.div 
                key="saving"
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', y: 10 }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(4px)', y: -10 }}
                className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500 text-[10px] font-bold uppercase tracking-widest bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/60 dark:border-white/10 px-4 py-2 rounded-full shadow-sm"
              >
                <Loader2 size={12} className="animate-spin text-brand" />
                Saving
              </motion.div>
            )}
            {saveStatus === 'saved' && (
              <motion.div 
                key="saved"
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)', y: 10 }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-brand text-[10px] font-bold uppercase tracking-widest bg-brand/5 backdrop-blur-md border border-brand/10 px-4 py-2 rounded-full shadow-sm"
              >
                <Check size={12} />
                Synced
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={toggleTheme}
            className="w-12 h-12 glass rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          
          <button 
            onClick={confirmDelete}
            className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-red-500 active:scale-95 transition-transform"
          >
            <Trash2 size={22} />
          </button>
        </div>
      </div>

      {/* Editor UI */}
      <div className="max-w-3xl mx-auto">
        <motion.input 
          layout
          type="text" 
          placeholder="Title"
          className="w-full bg-transparent text-3xl font-display font-black mb-8 focus:outline-none placeholder:opacity-20 text-neutral-900 dark:text-white"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
        
        <motion.div layout className={`relative leading-8 min-h-[65vh] ${formatterSettings.fontFamily} ${formatterSettings.fontSize} ${formatterSettings.textAlign}`}>
          {/* Mirror Layer (Renders actual text + Ghost Text) */}
          <div 
            className="w-full absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-neutral-950 dark:text-neutral-50 p-0 m-0 border-none select-none z-0"
            aria-hidden="true"
            style={{ fontVariantLigatures: 'none', boxSizing: 'border-box' }}
          >
            {(() => {
              const wordCounts = new Map<string, number>();
              const words = content.match(/\b[a-zA-Z_]\w*\b/g) || [];
              words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1));

              return content.split('\n').map((line, i) => {
                // Strip markdown tokens ONLY for formula detection so we know what is being calculated
                const unformattedLine = line.replace(/(\*\*|\*|_)/g, '');
                
                // 1. Check for Confirmed Calculation (e.g., "c = a + b = 6")
                const confirmedMatch = unformattedLine.match(/^([a-zA-Z_]\w*)\s*=\s*([^=]+=)(\s*(-?\d+(\.\d+)?))$/);
                
                // 2. Check for Pending Calculation (Ghost Text trigger)
                const liveResult = mathResults.find(r => r.lineIndex === i && r.isEvaluation);
                const ghostResult = !confirmedMatch && liveResult ? liveResult : null;

                // Function to render text with highlighted variables
                const hasEquals = line.includes('=');
                const renderWithHighlights = (rawText: string) => {
                  const parts = rawText.split(/(\b[a-zA-Z_]\w*\b)/g);
                  return parts.map((part, idx) => {
                    if (hasEquals && wordCounts.has(part) && (wordCounts.get(part) || 0) > 1) {
                      return <span key={idx} className="text-brand transition-colors duration-300 font-bold">{part}</span>;
                    }
                    return <span key={idx} className="text-neutral-900 dark:text-neutral-100">{part}</span>;
                  });
                };
                
                const renderWithMarkdown = (text: string) => {
                  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|_.*?_)/g);
                  return tokens.map((token, idx) => {
                    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
                      const inner = token.slice(2, -2);
                      return <span key={idx}><span className="opacity-30">**</span><span className="font-bold">{renderWithHighlights(inner)}</span><span className="opacity-30">**</span></span>;
                    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
                      const inner = token.slice(1, -1);
                      return <span key={idx}><span className="opacity-30">*</span><span className="italic">{renderWithHighlights(inner)}</span><span className="opacity-30">*</span></span>;
                    } else if (token.startsWith('_') && token.endsWith('_') && token.length >= 2) {
                      const inner = token.slice(1, -1);
                      return <span key={idx}><span className="opacity-30">_</span><span className="underline">{renderWithHighlights(inner)}</span><span className="opacity-30">_</span></span>;
                    }
                    return <span key={idx}>{renderWithHighlights(token)}</span>;
                  });
                };

                return (
                  <div key={i} className="min-h-[32px] relative">
                    {confirmedMatch ? (
                      <>
                        <span>{renderWithMarkdown(line.substring(0, line.length - confirmedMatch[3].length))}</span>
                        <motion.span 
                          key={`confirmed-${confirmedMatch[4]}-${liveResult?.value}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`font-bold transition-all duration-500 rounded-sm text-brand bg-brand/5 underline decoration-brand/20 underline-offset-4`}
                        >
                          {liveResult ? liveResult.value : confirmedMatch[4]}
                        </motion.span>
                      </>
                    ) : (
                      <>
                        <span>{renderWithMarkdown(line)}</span>
                        {ghostResult && (
                          <motion.span 
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-brand/60 font-bold ml-1 animate-pulse select-none italic text-[0.9em] cursor-default bg-brand/5 backdrop-blur-[2px] px-1 rounded-md border border-brand/10 shadow-sm shadow-brand/5"
                          >
                            {ghostResult.value}
                          </motion.span>
                        )}
                      </>
                    )}
                    {line === '' && <br />}
                  </div>
                );
              });
            })()}
          </div>

          {/* Input Layer */}
          <motion.textarea 
            layout
            ref={editorRef}
            spellCheck={false}
            placeholder="Start typing your note... e.g., a=2, b=4, c=a+b="
            className={`w-full h-full bg-transparent resize-none focus:outline-none text-transparent caret-neutral-900 dark:caret-neutral-100 absolute inset-0 z-10 p-0 m-0 border-none selection:bg-brand/10 leading-8 whitespace-pre-wrap break-words overflow-hidden ${formatterSettings.fontFamily} ${formatterSettings.fontSize} ${formatterSettings.textAlign}`}
            style={{ fontVariantLigatures: 'none', boxSizing: 'border-box' }}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onSelect={(e) => {
              const start = e.currentTarget.selectionStart;
              const end = e.currentTarget.selectionEnd;
              if (start !== end) {
                const text = content.substring(start, end);
                if (text.trim().length > 0) {
                  setSelection({ start, end, text });
                }
              } else {
                setSelection(null);
                setShowSelectionAI(false);
              }
            }}
            onMouseUp={(e) => setSelectionPos({ top: e.clientY })}
            onTouchEnd={(e) => {
              if (e.changedTouches.length > 0) {
                setSelectionPos({ top: e.changedTouches[0].clientY });
              }
            }}
            onKeyDown={(e) => {
              // try to update roughly on shift+arrow selection if no mouse
              if (e.shiftKey && e.key.includes('Arrow')) {
                // Approximate fallback for keyboard
                setSelectionPos({ top: window.innerHeight / 2 });
              }
              if (e.key === 'Backspace') {
                const cursor = editorRef.current?.selectionStart || 0;
                const beforeCursor = content.substring(0, cursor);
                const lines = beforeCursor.split('\n');
                const lastLine = lines[lines.length - 1];
                
                // Match confirmed result at the end of the current line before cursor
                // We check if the line matches the pattern and ends with the result string
                const confirmedResultMatch = lastLine.match(/=\s*(-?\d+(\.\d+)?)$/);
                
                if (confirmedResultMatch) {
                  const resultValue = confirmedResultMatch[1];
                  // If cursor is at the end of the line
                  if (beforeCursor.length === content.split('\n').slice(0, lines.length).join('\n').length) {
                    e.preventDefault();
                    // Delete the whole result value
                    const updatedContent = beforeCursor.substring(0, beforeCursor.length - resultValue.length) + content.substring(cursor);
                    setContent(updatedContent);
                    
                    // Set cursor position back
                    setTimeout(() => {
                      if (editorRef.current) {
                        const newCursor = cursor - resultValue.length;
                        editorRef.current.setSelectionRange(newCursor, newCursor);
                      }
                    }, 0);
                    return;
                  }
                }
              }

              if (['Enter', ' '].includes(e.key)) {
                const cursor = editorRef.current?.selectionStart || 0;
                const lines = content.split('\n');
                let charCount = 0;
                
                for (let i = 0; i < lines.length; i++) {
                  const lineEnd = charCount + lines[i].length;
                  if (cursor === lineEnd) {
                    const match = lines[i].match(/^([a-zA-Z_]\w*)\s*=\s*([^=]+)=$/);
                    const result = match ? mathResults.find(r => r.variable === match[1]) : null;
                    
                    if (result) {
                      e.preventDefault();
                      const newContent = [
                        ...lines.slice(0, i),
                        `${lines[i]}${result.value}`,
                        ...lines.slice(i + 1)
                      ].join('\n');
                      setContent(newContent);
                      return;
                    }
                  }
                  charCount = lineEnd + 1;
                }
              }
            }}
          />
        </motion.div>
      </div>
      </motion.div>

      {/* AI FAB - Only show when empty */}
      <AnimatePresence>
        {!showAIModal && !showSmartCompose && title === '' && content === '' && (
          <div className="fixed bottom-36 left-0 right-0 pointer-events-none z-30">
            <div className="max-w-3xl mx-auto px-8 flex justify-end">
              <motion.button
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: 20 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAIModal(true)}
                className="h-14 bg-brand text-white px-6 rounded-[20px] flex items-center gap-3 shadow-2xl shadow-brand/40 pointer-events-auto active:brightness-95 transition-all"
              >
                <Sparkles size={20} />
                <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">Smart AI</span>
              </motion.button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Sub-Menu Modal */}
      <AnimatePresence>
        {showAIModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-8 bg-black/5"
            onClick={() => setShowAIModal(false)}
          >
            <div className="fixed inset-0 pointer-events-none">
              <div className="max-w-3xl mx-auto h-full px-8 pb-10 flex flex-col items-end justify-end gap-3">
                <SubMenuItem 
                  icon={<Camera size={18} />} 
                  label="Scan Image" 
                  onClick={() => handleAIAction('ocr')} 
                />
                <SubMenuItem 
                  icon={<BrainCircuit size={18} />} 
                  label="Voice Note" 
                  onClick={() => alert("Voice feature coming soon!")} 
                />
                <SubMenuItem 
                  icon={<Sparkles size={18} />} 
                  label="Smart Compose" 
                  onClick={() => {
                    setShowAIModal(false);
                    setShowSmartCompose(true);
                  }} 
                />
                
                <button
                  onClick={() => setShowAIModal(false)}
                  className="mt-2 h-14 glass rounded-[20px] px-8 flex items-center gap-3 shadow-xl font-bold pointer-events-auto"
                >
                  <X size={20} />
                  <span>Close ({tokenStatus?.remaining || 0} tokens)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Compose Interface */}
      <AnimatePresence>
        {showSmartCompose && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSmartCompose(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl glass rounded-[40px] p-8 shadow-2xl border border-white/10"
            >
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <Sparkles className="text-brand" size={24} />
                  <h3 className="text-xl font-display font-black">Smart Compose</h3>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <SuggestionChip label="Make a shopping list" onClick={() => setSmartComposePrompt("Make a shopping list for ")} />
                  <SuggestionChip label="Vacation itinerary" onClick={() => setSmartComposePrompt("Suggest a 3-day vacation itinerary for ")} />
                  <SuggestionChip label="Explain this" onClick={() => setSmartComposePrompt("Explain this concept: ")} />
                </div>

                <div className="relative group">
                  <textarea
                    autoFocus
                    value={smartComposePrompt}
                    onChange={(e) => setSmartComposePrompt(e.target.value)}
                    placeholder="Type a command for AI..."
                    className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 text-neutral-900 dark:text-neutral-50 border-2 border-brand/10 dark:border-white/5 rounded-[28px] py-5 px-6 pr-16 focus:outline-none focus:border-brand/40 transition-all resize-none min-h-[140px] shadow-inner"
                  />
                  <button 
                    disabled={!smartComposePrompt.trim() || aiLoading}
                    onClick={() => handleAIAction('general')}
                    className="absolute bottom-4 right-4 w-12 h-12 bg-brand text-white rounded-[18px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 shadow-lg"
                  >
                    {aiLoading ? <Loader2 size={24} className="animate-spin" /> : <ArrowLeft className="rotate-[135deg]" size={24} />}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Footer Mask */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FAFAFA] dark:from-[#111111] via-[#FAFAFA]/90 dark:via-[#111111]/90 to-transparent pointer-events-none z-20"></div>

      {/* Formatting FAB Menu Constrained to Canvas */}
      <div className="fixed bottom-10 left-0 right-0 z-40 pointer-events-none flex justify-center px-6">
        <div className="max-w-3xl w-full relative pointer-events-auto flex items-center h-14">
          
          {/* Expanded actions (rolling carpet) */}
          <AnimatePresence>
            {showFormatter && (
              <motion.div
                initial={{ maxWidth: 56, opacity: 0 }}
                animate={{ maxWidth: 400, opacity: 1 }}
                exit={{ maxWidth: 56, opacity: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute left-0 h-14 w-max glass rounded-full flex items-center overflow-hidden origin-left"
              >
                <div className="flex items-center gap-1 pl-[64px] pr-4 w-max h-full relative">
                  <AnimatePresence mode="wait">
                    {activeFormatterMenu === 'main' && (
                      <motion.div 
                        key="main"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        {/* Font Family Menu Trigger */}
                        <FormattingBtn 
                          active={false} 
                          onClick={() => setActiveFormatterMenu('fontFamily')}
                          label={<Type size={16} />}
                        />
                        {/* Font Size Menu Trigger */}
                        <FormattingBtn 
                          active={false} 
                          onClick={() => setActiveFormatterMenu('fontSize')}
                          label={<ALargeSmall size={16} />}
                        />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
                        {/* Text Style (Direct Toggles) */}
                        <FormattingBtn 
                          active={false} 
                          onMouseDown={(e) => { e.preventDefault(); applyMarkdown('**'); }}
                          label={<Bold size={16} />}
                        />
                        <FormattingBtn 
                          active={false} 
                          onMouseDown={(e) => { e.preventDefault(); applyMarkdown('*'); }}
                          label={<Italic size={16} />}
                        />
                        <FormattingBtn 
                          active={false} 
                          onMouseDown={(e) => { e.preventDefault(); applyMarkdown('_'); }}
                          label={<Underline size={16} />}
                        />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
                        {/* Text Align Menu Trigger */}
                        <FormattingBtn 
                          active={false}
                          onClick={() => setActiveFormatterMenu('textAlign')}
                          label={<AlignLeft size={16} />}
                        />
                      </motion.div>
                    )}

                    {activeFormatterMenu === 'fontFamily' && (
                      <motion.div 
                        key="fontFamily"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        <FormattingBtn 
                          active={false} 
                          onClick={() => setActiveFormatterMenu('main')}
                          label={<ChevronLeft size={16} />}
                        />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
                        <FormattingBtn 
                          active={formatterSettings.fontFamily === 'font-sans'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontFamily: 'font-sans'})}
                          label={<span className="font-sans font-bold text-sm">Aa</span>}
                        />
                        <FormattingBtn 
                          active={formatterSettings.fontFamily === 'font-serif'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontFamily: 'font-serif'})}
                          label={<span className="font-serif italic font-bold text-sm">Aa</span>}
                        />
                        <FormattingBtn 
                          active={formatterSettings.fontFamily === 'font-mono'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontFamily: 'font-mono'})}
                          label={<span className="font-mono font-bold text-sm">Aa</span>}
                        />
                      </motion.div>
                    )}

                    {activeFormatterMenu === 'fontSize' && (
                      <motion.div 
                        key="fontSize"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        <FormattingBtn 
                          active={false} 
                          onClick={() => setActiveFormatterMenu('main')}
                          label={<ChevronLeft size={16} />}
                        />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
                        <FormattingBtn 
                          active={formatterSettings.fontSize === 'text-sm'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontSize: 'text-sm'})}
                          label={<span className="text-xs font-bold">A</span>}
                        />
                        <FormattingBtn 
                          active={formatterSettings.fontSize === 'text-lg'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontSize: 'text-lg'})}
                          label={<span className="text-sm font-bold">A</span>}
                        />
                        <FormattingBtn 
                          active={formatterSettings.fontSize === 'text-2xl'} 
                          onClick={() => setFormatterSettings({...formatterSettings, fontSize: 'text-2xl'})}
                          label={<span className="text-lg font-bold">A</span>}
                        />
                      </motion.div>
                    )}

                    {activeFormatterMenu === 'textAlign' && (
                      <motion.div 
                        key="textAlign"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                      >
                        <FormattingBtn 
                          active={false} 
                          onClick={() => setActiveFormatterMenu('main')}
                          label={<ChevronLeft size={16} />}
                        />
                        <div className="w-[1px] h-6 bg-black/10 dark:bg-white/10 mx-1"></div>
                        <FormattingBtn 
                          active={formatterSettings.textAlign === 'text-left'} 
                          onClick={() => setFormatterSettings({...formatterSettings, textAlign: 'text-left'})}
                          label={<AlignLeft size={16} />}
                        />
                        <FormattingBtn 
                          active={formatterSettings.textAlign === 'text-center'} 
                          onClick={() => setFormatterSettings({...formatterSettings, textAlign: 'text-center'})}
                          label={<AlignCenter size={16} />}
                        />
                        <FormattingBtn 
                          active={formatterSettings.textAlign === 'text-right'} 
                          onClick={() => setFormatterSettings({...formatterSettings, textAlign: 'text-right'})}
                          label={<AlignRight size={16} />}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (showFormatter) setActiveFormatterMenu('main');
              setShowFormatter(!showFormatter);
            }}
            className={`absolute left-0 w-14 h-14 rounded-full flex items-center justify-center text-neutral-900 dark:text-neutral-100 z-10 glass transition-shadow ${showFormatter ? 'shadow-[0_0_20px_rgba(161,66,244,0.3)]' : 'hover:shadow-lg'}`}
          >
            {showFormatter ? <X size={20} /> : <Palette size={20} />}
          </motion.button>
        </div>
      </div>

      {/* AI Context Menu when text is selected */}
      <AnimatePresence>
        {selection && !showSelectionAI && (
          <div 
            className="fixed z-40 pointer-events-none"
            style={{ 
              left: '50%', 
              top: typeof window !== 'undefined' ? Math.min(Math.max(selectionPos.top + 30, 80), window.innerHeight - 80) : '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <motion.button
              initial={{ scale: 0, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: -20 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSelectionAI(true)}
              className="h-12 bg-gradient-to-r from-[#4285F4] via-[#A142F4] to-[#E54360] text-white px-6 rounded-full flex items-center gap-2 shadow-[0_4px_30px_rgba(161,66,244,0.6)] pointer-events-auto transition-all font-bold text-sm border border-white/20 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Sparkles size={16} className="animate-pulse relative z-10" />
              <span className="relative z-10">AI Creation</span>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* AI Selection Modal (Samsung Style) */}
      <AnimatePresence>
        {showSelectionAI && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSelectionAI(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-3xl bg-white dark:bg-[#1C1C1E] rounded-t-[32px] p-4 pb-8 shadow-[0_-10px_50px_rgba(161,66,244,0.25)] relative overflow-hidden"
            >
              {/* Glowing Top Border */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4285F4] via-[#A142F4] to-[#E54360] shadow-[0_0_15px_rgba(161,66,244,0.6)]"></div>
              {/* Background Ambient Glow */}
              <div className="absolute -top-24 -left-10 w-56 h-56 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none animate-pulse"></div>
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/20 rounded-full blur-[40px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between px-2 pt-2">
                  <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500 flex items-center gap-2">
                    <Sparkles size={16} className="text-[#A142F4]" /> AI Creation
                  </h3>
                  <button onClick={() => setShowSelectionAI(false)} className="p-2 opacity-50 hover:opacity-100 text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 rounded-full"><X size={16} /></button>
                </div>

                <div className="relative mt-2">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500">
                    <Sparkles size={16} />
                  </div>
                  <input
                    type="text"
                    value={selectionAIPrompt}
                    onChange={(e) => setSelectionAIPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && selectionAIPrompt.trim()) {
                        handleAISelectionAction('custom');
                      }
                    }}
                    placeholder="Enter requirements"
                    className="w-full bg-neutral-100 dark:bg-[#2C2C2E] text-neutral-900 dark:text-white rounded-[16px] py-4 pl-12 pr-14 focus:outline-none transition-all text-sm font-medium placeholder:text-neutral-500"
                  />
                  {selectionAIPrompt.trim() && (
                    <button 
                      onClick={() => handleAISelectionAction('custom')}
                      disabled={aiLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white rounded-full flex items-center justify-center disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeft size={16} className="rotate-[135deg]" />}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <AIActionButton icon={<AlignLeft size={18} />} label="Summary" onClick={() => handleAISelectionAction('summary')} disabled={aiLoading} />
                  <AIActionButton icon={<Wand2 size={18} />} label="Polish" onClick={() => handleAISelectionAction('polish')} disabled={aiLoading} />
                  <AIActionButton icon={<Minimize2 size={18} />} label="Shorten" onClick={() => handleAISelectionAction('shorten')} disabled={aiLoading} />
                  <AIActionButton icon={<Maximize2 size={18} />} label="Extend" onClick={() => handleAISelectionAction('extend')} disabled={aiLoading} />
                  <AIActionButton icon={<PenTool size={18} />} label="Continue writing" onClick={() => handleAISelectionAction('continue')} disabled={aiLoading} />
                  <AIActionButton icon={<CheckSquare size={18} />} label="Revise grammar" onClick={() => handleAISelectionAction('grammar')} disabled={aiLoading} />
                  <AIActionButton icon={<LayoutTemplate size={18} />} label="Smart layout" onClick={() => handleAISelectionAction('layout')} disabled={aiLoading} />
                  <AIActionButton icon={<Check size={18} />} label="Extract to-dos" onClick={() => handleAISelectionAction('todos')} disabled={aiLoading} />
                  <AIActionButton icon={<Languages size={18} />} label="Translate" onClick={() => handleAISelectionAction('translate')} disabled={aiLoading} className="col-span-2" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const SubMenuItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <motion.button
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="h-14 glass text-neutral-800 dark:text-neutral-100 gap-3 px-6 rounded-[20px] flex items-center shadow-lg transition-colors min-w-[180px] justify-between group pointer-events-auto"
  >
    <span className="font-bold text-sm">{label}</span>
    <div className="text-neutral-400 group-hover:text-brand transition-colors">{icon}</div>
  </motion.button>
);

const SuggestionChip: React.FC<{ 
  label: string; 
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    className="px-4 py-2 glass rounded-full text-neutral-500 dark:text-neutral-400 text-xs font-bold whitespace-nowrap transition-all hover:text-brand hover:border-brand/40"
  >
    {label}
  </button>
);

const AIActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ icon, label, onClick, disabled, className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`h-14 bg-neutral-100 dark:bg-[#323234] text-neutral-900 dark:text-white rounded-[16px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 ${className}`}
  >
    <div className="opacity-70">
      {icon}
    </div>
    <span className="text-[11px] font-bold tracking-tight">{label}</span>
  </button>
);

const FormattingBtn: React.FC<{
  active: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  label: React.ReactNode;
}> = ({ active, onClick, onMouseDown, label }) => (
  <button
    onClick={onClick}
    onMouseDown={onMouseDown}
    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
      active 
        ? 'bg-gradient-to-tr from-[#4285F4] to-[#A142F4] text-white shadow-md shadow-purple-500/20' 
        : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
    }`}
  >
    {label}
  </button>
);
