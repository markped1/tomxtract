import { useState, useEffect, useRef } from 'react'
import { 
  MessageCircle, 
  History,
  LayoutDashboard,
  Settings,
  X,
  Plus,
  ShieldCheck,
  UserPlus,
  CheckCheck,
  AlertCircle,
  LogOut
} from 'lucide-react'
import { twistMessage } from './utils/twister'

const AppLogo = () => (
  <div className="flex items-center gap-1">
    <div className="w-4 h-4 bg-[#25D366] rounded flex items-center justify-center">
      <MessageCircle className="w-3 h-3 text-white fill-current" />
    </div>
    <span className="text-[10px] font-black text-[#128C7E] tracking-tighter uppercase leading-none">TOM<span className="text-[#25D366]">WHATS</span></span>
  </div>
)

function App() {
  // 1. State
  const [activeTab, setActiveTab] = useState('campaign')
  const [status, setStatus] = useState<any>({ isReady: false, isAuthenticated: false, qrCode: null })
  const [contacts, setContacts] = useState<any[]>([])
  const [extractionResults, setExtractionResults] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [messageTemplate, setMessageTemplate] = useState('')
  const [isSmartTwistEnabled, setIsSmartTwistEnabled] = useState(true)
  const [countryCode, setCountryCode] = useState('234')
  const [startNumber, setStartNumber] = useState('')
  const [quantity, setQuantity] = useState(100)
  const [isVerifying, setIsVerifying] = useState(false)
  const isVerifyingRef = useRef(false)
  const [isSending, setIsSending] = useState(false)
  const isSendingRef = useRef(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 2. Helpers (Defined BEFORE useEffect to avoid hoisting issues)
  const loadData = async () => {
    const api = (window as any).api;
    if (!api) return;
    try {
      const c = await api.getContacts()
      const l = await api.getLogs()
      setContacts(c || [])
      setLogs(l || [])
    } catch (e) { console.error('Data Load Fail') }
  }

  const [debugLog, setDebugLog] = useState<string>('Booting...')

  const loadStatus = async () => {
    const api = (window as any).api;
    if (!api) return;
    try {
      const s = await api.getStatus()
      if (s) {
        setDebugLog(`API Poll: Ready=${s.isReady}, Auth=${s.isAuthenticated}, QR_Length=${s.qrCode ? s.qrCode.length : 0}`)
        setStatus((prev: any) => ({ 
           ...prev, 
           isAuthenticated: s.isAuthenticated, 
           isReady: s.isReady, 
           qrCode: s.qrCode ? s.qrCode : prev.qrCode 
        }))
      }
    } catch (e) {
      setDebugLog('Poll Error')
    }
  }

  const callInit = async () => {
    const api = (window as any).api;
    if (!api) return;
    try {
      if (typeof api.init === 'function') await api.init();
      else if (typeof api.initWhatsApp === 'function') await api.initWhatsApp();
      await loadData()
    } catch (e: any) { 
      setError(`Engine Error: ${e.message}`);
    }
  }

  // 3. Effects
  useEffect(() => {
    // We only callInit ONCE on mount
    callInit()
    const timer = setInterval(loadStatus, 2000)
    
    // Setup WhatsApp Event Listener for real-time QR updates
    const api = (window as any).api;
    let cleanup = () => {};
    if (api && typeof api.onWhatsAppEvent === 'function') {
      cleanup = api.onWhatsAppEvent((event: any) => {
        if (event.type === 'qr') {
          setStatus((prev: any) => ({ ...prev, qrCode: event.data }))
          setDebugLog(`Event: QR received (${event.data.length} chars)`)
        } else if (event.type === 'authenticated' || event.type === 'ready') {
          setStatus((prev: any) => ({ ...prev, isAuthenticated: true, isReady: true, qrCode: null }))
          setIsConnectModalOpen(false)
        } else if (event.type === 'disconnected') {
           setStatus({ isReady: false, isAuthenticated: false, qrCode: null })
        } else if (event.type === 'error') {
           setError(`WhatsApp Error: ${event.data}`)
        }
      })
    }
    
    return () => {
      clearInterval(timer)
      cleanup()
    }
  }, [])

  useEffect(() => {
    if (status.isReady && isConnectModalOpen) setIsConnectModalOpen(false)
  }, [status.isReady, isConnectModalOpen])

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 4. Handlers
  const handleConnect = async () => {
    setIsConnectModalOpen(true)
    // We do NOT call callInit() here anymore.
  }

  const handleGenerateNumbers = async () => {
    const api = (window as any).api;
    if (!api) return;
    setIsVerifying(true)
    isVerifyingRef.current = true
    setError(null)
    setExtractionResults([])
    const base = parseInt(startNumber)
    if (!base) { setError("Set Start Num"); setIsVerifying(false); isVerifyingRef.current = false; return; }

    for (let i = 0; i < quantity; i++) {
       if (!isVerifyingRef.current) break
       const num = (base + i).toString()
       const fullNum = `${countryCode}${num}`
       try {
         const isReg = await api.isRegistered(fullNum)
         if (isReg) {
           const lead = { phone: fullNum, name: `Lead ${i+1}` }
           setExtractionResults(prev => [lead, ...prev])
           await api.addContacts([lead])
         }
       } catch (e: any) { console.error(e) }
       await new Promise(r => setTimeout(r, 1000))
    }
    setIsVerifying(false)
    isVerifyingRef.current = false
    await loadData()
  }

  const handleStopVerification = () => {
    setIsVerifying(false)
    isVerifyingRef.current = false
  }

  const handleExportLeads = () => {
    if (extractionResults.length === 0) {
      setError("No leads to export");
      return;
    }
    const csvContent = "data:text/csv;charset=utf-8,Phone,Name\n" 
      + extractionResults.map(e => `${e.phone},${e.name}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "whatsapp_active_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleTransferToCampaign = async () => {
    const api = (window as any).api;
    if (!api || extractionResults.length === 0) return;
    try {
      await api.addContacts(extractionResults);
      await loadData();
      setSuccess("Leads Transferred to Campaign!");
      setError(null);
    } catch(e) { console.error(e) }
  }

  const handleImportContacts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      
      const lines = text.split('\n');
      const api = (window as any).api;
      if (!api) return;
      
      const newContacts: any[] = [];
      lines.forEach((line, i) => {
        const parts = line.split(',');
        let phone = parts[0]?.trim() || '';
        phone = phone.replace(/\D/g, ''); // Extract only digits
        
        if (phone.length > 5) {
          newContacts.push({ phone, name: parts[1]?.trim() || `Imported ${i+1}` });
        }
      });
      
      if (newContacts.length > 0) {
        await api.addContacts(newContacts);
        await loadData();
        setSuccess(`Imported ${newContacts.length} numbers successfully!`);
        setError(null);
      } else {
        setError('No valid numbers found in file.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  }


  const handleStartCampaign = async () => {
    const api = (window as any).api;
    if (!api || !status.isReady) { setError("Connect WhatsApp"); return; }
    if (contacts.length === 0) { setError("No leads"); return; }
    setIsSending(true)
    for (const contact of contacts) {
      if (!isSending) break;
      try {
        let finalMessage = messageTemplate.replace('{name}', contact.name || '')
        if (isSmartTwistEnabled) finalMessage = twistMessage(finalMessage, 0.3)
        await api.sendMessage({ phone: contact.phone, message: finalMessage })
        await loadData()
      } catch (e) { console.error(e) }
      await new Promise(r => setTimeout(r, 60000))
    }
    setIsSending(false)
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5] text-[#3b4a54] font-sans selection:bg-[#25D366]/30 text-[9px] overflow-hidden">
      
      {/* Header */}
      <header className="h-9 bg-[#00A884] flex items-center px-2 justify-between shrink-0 z-30 shadow-sm">
        <div className="bg-white px-1 py-0.5 rounded shadow-sm"><AppLogo /></div>
        <div className="flex items-center gap-1.5">
          <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-white/20 text-white font-black text-[7px] uppercase`}>
             <div className={`w-1 h-1 rounded-full ${status.isReady ? 'bg-[#25D366]' : 'bg-white'}`} />
             {status.isReady ? 'LIVE' : 'OFF'}
          </div>
          {!status.isReady && (
            <button onClick={handleConnect} className="bg-white text-[#00A884] px-2 py-0.5 rounded font-black text-[8px] active:scale-95 transition-all shadow-sm">LINK</button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-8 bg-white border-r flex flex-col items-center py-2 gap-3 shrink-0 z-20">
          <button onClick={() => setActiveTab('campaign')} className={`p-1 rounded ${activeTab === 'campaign' ? 'text-[#00A884] bg-[#F0F2F5]' : 'text-gray-300'}`}><LayoutDashboard className="w-4 h-4" /></button>
          <button onClick={() => setActiveTab('generator')} className={`p-1 rounded ${activeTab === 'generator' ? 'text-[#00A884] bg-[#F0F2F5]' : 'text-gray-300'}`}><UserPlus className="w-4 h-4" /></button>
          <button onClick={() => setActiveTab('history')} className={`p-1 rounded ${activeTab === 'history' ? 'text-[#00A884] bg-[#F0F2F5]' : 'text-gray-300'}`}><History className="w-4 h-4" /></button>
          <div className="mt-auto flex flex-col items-center gap-3 w-full">
            <button onClick={() => setActiveTab('settings')} className={`p-1 rounded ${activeTab === 'settings' ? 'text-[#00A884] bg-[#F0F2F5]' : 'text-gray-300 hover:text-gray-500'}`}><Settings className="w-4 h-4" /></button>
            <button className="p-1 text-red-300 hover:text-red-500"><LogOut className="w-4 h-4" /></button>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          
          <div className="flex-1 flex overflow-hidden p-1.5 gap-1.5">
             
             {/* Dynamic Main View based on activeTab */}
             {activeTab === 'campaign' && (
               <section className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="bg-white rounded border p-1.5 flex flex-col h-full shadow-sm">
                     <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-gray-300 text-[10px] uppercase">EDITOR</span>
                        <ShieldCheck className="w-3 h-3 text-[#00A884]" />
                     </div>
                     <div className="relative flex-1">
                        <textarea 
                          value={messageTemplate}
                          onChange={(e) => setMessageTemplate(e.target.value)}
                          placeholder="Type message..."
                          className="w-full h-full p-2 bg-[#F8F9FA] border rounded outline-none text-[10px] font-bold"
                        />
                        <div className="absolute bottom-1 right-1 flex items-center gap-1 bg-white border p-0.5 rounded scale-75 origin-bottom-right">
                           <span className="text-[7px] font-black text-gray-400 uppercase">Twist</span>
                           <button onClick={() => setIsSmartTwistEnabled(!isSmartTwistEnabled)} className={`w-5 h-2.5 rounded-full relative ${isSmartTwistEnabled ? 'bg-[#00A884]' : 'bg-gray-300'}`}>
                              <div className={`absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full transition-transform ${isSmartTwistEnabled ? 'left-3' : 'left-0.5'}`} />
                           </button>
                        </div>
                     </div>
                     <div className="mt-1.5 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-1.5 bg-gray-50 border rounded px-1.5 py-0.5 shadow-sm">
                           <label className="cursor-pointer flex items-center gap-1 text-[8px] font-black text-[#00A884] uppercase tracking-wider hover:text-[#009272] transition-colors">
                              <Plus className="w-2.5 h-2.5" /> IMPORT
                              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleImportContacts} />
                           </label>
                           <div className="w-px h-3 bg-gray-200 mx-0.5" />
                           <span className="text-[7px] font-black text-gray-400">QUEUED: {contacts.length}</span>
                        </div>
                        <button 
                          onClick={isSending ? handleStopSending : handleStartCampaign}
                          disabled={!status.isReady}
                          className={`px-4 py-1 rounded font-black text-[10px] uppercase tracking-tighter shadow ${isSending ? 'bg-red-500 text-white' : 'bg-[#00A884] text-white active:scale-95'}`}
                        >
                           {isSending ? 'STOP' : 'SEND LOGIC'}
                        </button>
                     </div>

                  </div>
               </section>
             )}

             {activeTab !== 'campaign' && (
               <section className="flex-1 flex flex-col bg-white rounded border p-3 items-center justify-center text-gray-400">
                  <span className="font-black text-[10px] uppercase tracking-widest">{activeTab} MODULE</span>
                  <span className="text-[8px] mt-1 text-center">This section is currently under construction<br/>for the new 450px layout.</span>
               </section>
             )}

             {/* Lead Results */}
             <aside className="w-[110px] bg-white rounded border flex flex-col overflow-hidden shrink-0 shadow-sm">
                <div className="p-1 px-1.5 border-b bg-[#F0F2F5] shrink-0 flex items-center justify-between text-[7px] font-black">
                   <span className="text-gray-500 uppercase">LEADS</span>
                   <span className="text-[#00A884]">{extractionResults.length}</span>
                </div>
                <div className="p-1 border-b bg-[#F8F9FA] space-y-1 shrink-0">
                   <div className="flex gap-1">
                      <input value={countryCode} onChange={e => setCountryCode(e.target.value)} className="w-1/2 p-0.5 border text-[9px] rounded font-bold outline-none" placeholder="234" />
                      <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} className="w-1/2 p-0.5 border text-[9px] rounded font-bold outline-none" />
                   </div>
                   <input value={startNumber} onChange={e => setStartNumber(e.target.value)} placeholder="0803..." className="w-full p-0.5 border text-[9px] rounded font-bold outline-none" />
                   <button onClick={isVerifying ? handleStopVerification : handleGenerateNumbers} className="w-full py-1 bg-[#2563EB] text-white rounded text-[8px] font-black uppercase tracking-widest">{isVerifying ? 'STOP' : 'EXTRACT'}</button>
                   {extractionResults.length > 0 && (
                      <div className="flex gap-1 mt-1">
                         <button onClick={handleExportLeads} className="flex-1 py-1 rounded bg-gray-200 text-gray-500 font-black text-[7px] uppercase tracking-widest cursor-pointer hover:bg-gray-300 transition-colors">CSV</button>
                         <button onClick={handleTransferToCampaign} className="flex-1 py-1 rounded bg-[#00A884] text-white font-black text-[7px] uppercase tracking-widest cursor-pointer hover:bg-[#009272] transition-colors">Transfer</button>
                      </div>
                   )}
                </div>
                <div className="flex-1 overflow-y-auto p-1 space-y-1 bg-[#F8F9FA] custom-scroll">
                   {extractionResults.map((lead, i) => (
                      <div key={i} className="bg-white p-1 rounded border border-black/5 flex items-center justify-between text-[8px] font-bold">
                         <span className="truncate">+{lead.phone}</span>
                         <CheckCheck className="w-2 h-2 text-[#25D366]" />
                      </div>
                   ))}
                </div>
             </aside>
          </div>

          {/* Delivery Feed */}
          <div className="h-28 bg-white border-t mt-auto flex flex-col overflow-hidden shrink-0 shadow-md">
             <div className="px-2 py-0.5 border-b bg-[#F0F2F5]/50 flex items-center justify-between shrink-0 font-black text-[7px] text-gray-400 tracking-widest uppercase">
                <span>FEED</span>
                <button onClick={async () => { await (window as any).api.clearLogs(); loadData(); }} className="text-red-400 scale-90">X</button>
             </div>
             <div className="flex-1 overflow-y-auto p-1.5 space-y-1 bg-[#F8F9FA] custom-scroll">
                {logs.map((log: any, i: number) => (
                   <div key={i} className="flex items-center gap-1.5 border-b border-black/[0.02] pb-0.5 last:border-0 text-[8px] font-bold">
                      <span className="text-gray-300 flex-shrink-0 font-mono text-[7px]">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="text-[#128C7E] flex-shrink-0">+{log.phone}</span>
                      <span className="text-gray-400 italic truncate flex-1">"{log.message || '...'}"</span>
                      <span className={`${log.status === 'sent' ? 'text-[#00A884]' : 'text-red-500'} flex-shrink-0 text-[7px]`}>{log.status === 'sent' ? 'OK' : 'FAIL'}</span>
                   </div>
                ))}
                <div ref={logEndRef} />
             </div>
          </div>
        </div>
      </div>

      {/* Connection Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl w-[180px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-2 bg-[#00A884] text-white text-center font-black text-[9px] uppercase tracking-widest">WHATSAPP LINK</div>
              <div className="p-4 flex flex-col items-center gap-4">
                 {status.qrCode ? (
                    <div className="p-1 border rounded bg-white shadow-inner animate-in fade-in zoom-in-50">
                      <img src={status.qrCode} alt="QR" className="w-32 h-32" />
                    </div>
                 ) : (
                    <div className="w-32 h-32 flex flex-col items-center justify-center text-gray-300 animate-pulse text-[8px] font-black uppercase text-center">
                      Initing<br/>Engine...
                      <span className="text-[6px] text-red-400 mt-2 normal-case font-mono">{debugLog}</span>
                    </div>
                 )}
                 <button onClick={() => setIsConnectModalOpen(false)} className="w-full py-1.5 bg-gray-50 text-gray-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-2 left-2 right-2 bg-red-600 text-white p-1.5 rounded shadow-xl flex items-center gap-2 z-[60] text-[8px] font-black animate-in slide-in-from-bottom-2">
           <AlertCircle className="w-2.5 h-2.5 shrink-0" />
           <p className="flex-1 truncate uppercase tracking-tighter">{error}</p>
           <button onClick={() => setError(null)}><X className="w-2.5 h-2.5" /></button>
        </div>
      )}

      {success && (
        <div className="fixed bottom-2 left-2 right-2 bg-[#00A884] text-white p-1.5 rounded shadow-xl flex items-center gap-2 z-[60] text-[8px] font-black animate-in slide-in-from-bottom-2">
           <CheckCheck className="w-2.5 h-2.5 shrink-0" />
           <p className="flex-1 truncate uppercase tracking-tighter">{success}</p>
           <button onClick={() => setSuccess(null)}><X className="w-2.5 h-2.5" /></button>
        </div>
      )}

    </div>
  )
}

export default App
