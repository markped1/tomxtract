import React, { useState, useEffect } from 'react';
import { GlowButton } from '../components/GlowButton';
import { Mail, Loader2, Play, Square, Plus, Trash2, CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';

interface SmtpAccount {
  id?: number;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

interface MailingLog {
  id: number;
  recipient: string;
  subject: string;
  status: string;
  error?: string;
  sent_at: string;
}

export const Mailer: React.FC = () => {
  const [smtps, setSmtps] = useState<SmtpAccount[]>([]);
  const [logs, setLogs] = useState<MailingLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // SMTP Form state
  const [newSmtp, setNewSmtp] = useState<SmtpAccount>({
    host: '', port: 465, user: '', pass: '', secure: true,
    fromName: '', fromEmail: '', replyTo: ''
  });
  
  // Campaign state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');

  // Initial Data Fetching
  useEffect(() => {
    let cleanupFunc: (() => void) | undefined;
    
    const init = async () => {
      try {
        // Load settings and data in parallel without blocking UI
        loadData(); // Fire and forget initial load
        
        if (window.electronAPI) {
          window.electronAPI.getMailingSettings().then(settings => {
            if (settings) {
              if (settings.subject) setSubject(settings.subject);
              if (settings.body) setBody(settings.body);
              if (settings.recipients) setRecipients(settings.recipients);
            }
          }).catch(err => console.error('Mailing settings error:', err));

          cleanupFunc = window.electronAPI.onMailingEvent((_event, data: any) => {
            if (!data) return;
            if (data.type === 'started') { setIsRunning(true); setStatus('Sending...'); }
            else if (data.type === 'complete') { setIsRunning(false); setStatus('Complete'); loadData(); }
            else if (data.type === 'stopped') { setIsRunning(false); setStatus('Stopped'); }
            else if (data.type === 'sent') { setStatus(`Sent to ${data.recipient}`); loadData(); }
            else if (data.type === 'waiting') { setStatus('Waiting (1 min)...'); }
            else if (data.type === 'error') { setStatus(`Error: ${data.message || 'Unknown error'}`); loadData(); }
          });
        }
      } catch (err: any) {
        console.error('Mailer initialization error:', err);
      } finally {
        setLoading(false); // Enable UI regardless of data fetch success
      }
    };

    init();
    return () => {
      if (cleanupFunc) cleanupFunc();
    };
  }, []);

  const loadData = async () => {
    if (window.electronAPI) {
      try {
        const s = await window.electronAPI.getSmtps();
        setSmtps(Array.isArray(s) ? s : []);
        
        const l = await window.electronAPI.getMailingLogs();
        setLogs(Array.isArray(l) ? l : []);

        // Check if already running
        const stats = await window.electronAPI.getStats();
        if (stats && stats.isMailerRunning) {
          setIsRunning(true);
          setStatus('Sending...');
        }
      } catch (err) {
        console.error('Failed to load Mailer data:', err);
      }
    }
  };

  const handleAddSmtp = async () => {
    if (!newSmtp.host || !newSmtp.user || !newSmtp.pass) {
      alert('Please fill in host, username, and password');
      return;
    }
    
    // Auto-correct secure toggle based on port to prevent SSL errors
    let finalSmtp = { ...newSmtp };
    if (newSmtp.port === 465) finalSmtp.secure = true;
    if (newSmtp.port === 587 || newSmtp.port === 25) finalSmtp.secure = false;

    if (window.electronAPI) {
      await window.electronAPI.addSmtp(finalSmtp);
      loadData();
      setNewSmtp({
        host: '', port: 465, user: '', pass: '', secure: true,
        fromName: '', fromEmail: '', replyTo: ''
      });
    }
  };

  const handleDeleteSmtp = async (id: number) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteSmtp(id);
      loadData();
    }
  };

  const handleTestSmtp = async (smtp: SmtpAccount) => {
    if (window.electronAPI) {
      const result = await window.electronAPI.testSmtp(smtp);
      if (result.success) {
        alert('SMTP Connection Successful!');
      } else {
        alert('SMTP Connection Failed: ' + result.error);
      }
    }
  };

  const handleStartCampaign = async () => {
    if (smtps.length === 0) {
      alert('Please add at least one SMTP account');
      return;
    }
    if (!subject || !body || !recipients) {
      alert('Please fill in subject, body, and recipients');
      return;
    }
    
    const recipientList = recipients.split(/[\n,]/).map(r => r.trim()).filter(r => r.includes('@'));
    if (recipientList.length === 0) {
      alert('No valid recipients found');
      return;
    }

    if (window.electronAPI) {
      await window.electronAPI.startMailing({
        subject,
        body,
        recipients: recipientList
      });
    }
  };

  const handleStopCampaign = async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopMailing();
    }
  };
  
  const handleClearMemory = async () => {
    if (confirm('Are you sure you want to clear all sender memory?')) {
      if (window.electronAPI) {
        await window.electronAPI.clearSmtps();
        loadData();
      }
    }
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all delivery logs?')) {
      if (window.electronAPI) {
        await window.electronAPI.clearMailingLogs();
        loadData();
      }
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center animate-pulse">
        <Loader2 className="w-10 h-10 text-cyber-accent mx-auto mb-4 animate-spin" />
        <p className="text-gray-500">Connecting to Mailer System...</p>
      </div>
    );
  }

  // Double check recipients split logic
  const handleRecipientsChange = (val: string) => {
    setRecipients(val);
    if (window.electronAPI) {
      window.electronAPI.saveMailingSetting({ key: 'recipients', value: val }).catch(() => {});
    }
  };

  return (
    <div key="mailer-root" className="space-y-6 animate-fade-in relative pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
            <Mail className="text-cyber-accent" />
            Email Sender
          </h1>
          <p className="text-sm text-gray-400 mt-1">Send campaigns with auto-rotation (1 email per minute)</p>
        </div>
        <div className="flex items-center gap-3">
            <button 
            onClick={handleClearMemory}
            className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all flex items-center gap-1.5"
            title="Remove all saved SMTP accounts"
          >
            <Trash2 size={12} /> Clear All SMTPs
          </button>
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
            isRunning ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'
          }`}>
            Status: {status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SMTP Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-5 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-cyber-accent uppercase flex items-center gap-2">
                <Plus size={16} /> Add SMTP Account
              </h3>
              <button 
                onClick={() => setNewSmtp({...newSmtp, host: 'smtp.gmail.com', port: 587, secure: false})}
                className="text-[10px] text-gray-400 hover:text-cyber-accent border border-gray-700 hover:border-cyber-accent/50 px-2 py-0.5 rounded transition-all"
              >
                + Gmail Preset
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="SMTP Host (e.g. smtp.gmail.com)"
                value={newSmtp.host}
                onChange={e => setNewSmtp({...newSmtp, host: e.target.value})}
                className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Port"
                  value={newSmtp.port}
                  onChange={e => setNewSmtp({...newSmtp, port: parseInt(e.target.value)})}
                  className="w-24 bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
                />
                <label className="flex items-center gap-2 text-xs text-gray-400 px-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSmtp.secure}
                    onChange={e => setNewSmtp({...newSmtp, secure: e.target.checked})}
                    className="rounded bg-cyber-bg border-gray-700 pointer-events-auto"
                  />
                  SSL/TLS
                </label>
              </div>
              <input
                type="text"
                placeholder="Username / Email"
                value={newSmtp.user}
                onChange={e => setNewSmtp({...newSmtp, user: e.target.value})}
                className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
              />
              <input
                type="password"
                placeholder="Direct Password"
                value={newSmtp.pass}
                onChange={e => setNewSmtp({...newSmtp, pass: e.target.value})}
                className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="From Name"
                  value={newSmtp.fromName}
                  onChange={e => setNewSmtp({...newSmtp, fromName: e.target.value})}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
                />
                <input
                  type="text"
                  placeholder="From Email"
                  value={newSmtp.fromEmail}
                  onChange={e => setNewSmtp({...newSmtp, fromEmail: e.target.value})}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
                />
              </div>
              <input
                type="text"
                placeholder="Reply-To (Optional)"
                value={newSmtp.replyTo}
                onChange={e => setNewSmtp({...newSmtp, replyTo: e.target.value})}
                className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text"
              />
              <div className="flex gap-2">
                <GlowButton onClick={handleAddSmtp} className="flex-1">Save SMTP</GlowButton>
                <button 
                  onClick={() => setNewSmtp({ host: '', port: 465, user: '', pass: '', secure: true, fromName: '', fromEmail: '', replyTo: '' })}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs hover:bg-gray-700 transition-all"
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>

          {/* SMTP List */}
          <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
            <h3 className="text-xs font-bold text-gray-500 uppercase px-1">Active Senders ({smtps.length})</h3>
            {smtps.map(smtp => (
              <div key={smtp.id} className="bg-cyber-card/50 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyber-text truncate">{smtp.user}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{smtp.host}:{smtp.port}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleTestSmtp(smtp)} className="p-1 hover:text-green-400 text-gray-500" title="Test Connection">
                      <Play size={12} fill="currentColor" />
                    </button>
                    <button onClick={() => smtp.id && handleDeleteSmtp(smtp.id)} className="p-1 hover:text-red-400 text-gray-500" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {smtp.replyTo && (
                  <p className="text-[10px] text-cyber-accent/80 italic">Reply-to: {smtp.replyTo}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-6 space-y-5">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase px-1">Recipients (Email per line or comma)</label>
                  <textarea
                    rows={4}
                    value={recipients}
                    onChange={e => handleRecipientsChange(e.target.value)}
                    placeholder="example@mail.com&#10;test@demo.org"
                    className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-4 py-3 text-sm text-cyber-text focus:border-cyber-accent/50 focus:outline-none custom-scrollbar"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase px-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => {
                      const val = e.target.value;
                      setSubject(val);
                      window.electronAPI?.saveMailingSetting({ key: 'subject', value: val });
                    }}
                    placeholder="Enter email subject..."
                    className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-4 py-3 text-sm text-cyber-text focus:border-cyber-accent/50 focus:outline-none"
                  />
                  <div className="p-3 bg-cyber-accent/5 border border-cyber-accent/20 rounded-lg text-[11px] text-gray-400 leading-relaxed mt-2">
                    <Clock size={12} className="inline mr-1 text-cyber-accent" />
                    **Safety Rule**: System sends 1 email per minute across all rotated SMTPs to maximize deliverability and avoid spam filters.
                    <br/><br/>
                    <AlertCircle size={12} className="inline mr-1 text-yellow-500" />
                    **SSL Tip**: Use **Port 465** with **SSL/TLS checked**, OR **Port 587** with **SSL/TLS unchecked**.
                  </div>
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Message Body (HTML supported)</label>
                  <div className="flex gap-2">
                    {['{email}', '{domain}', '{date}'].map(tag => (
                      <span key={tag} className="text-[10px] bg-cyber-accent/10 border border-cyber-accent/30 text-cyber-accent px-1.5 py-0.5 rounded font-mono cursor-help" title={`Replaced by recipient's ${tag.slice(1, -1)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={body}
                  onChange={e => {
                    const val = e.target.value;
                    setBody(val);
                    window.electronAPI?.saveMailingSetting({ key: 'body', value: val });
                  }}
                  placeholder="Write your professional message here...&#10;Hello, I found your contact at {domain}. My system shows the date is {date}."
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-4 py-3 text-sm text-cyber-text focus:border-cyber-accent/50 focus:outline-none custom-scrollbar"
                />
             </div>

             <div className="flex gap-3">
               {!isRunning ? (
                 <GlowButton onClick={handleStartCampaign} className="flex-1 flex justify-center gap-2 items-center py-3">
                   <Play size={18} fill="currentColor" /> Start Mailing Campaign
                 </GlowButton>
               ) : (
                 <GlowButton onClick={handleStopCampaign} variant="secondary" className="flex-1 flex justify-center gap-2 items-center py-3 border-red-500/50 hover:bg-red-500/10 text-red-400">
                   <Square size={18} fill="currentColor" /> Stop Campaign
                 </GlowButton>
               )}
             </div>
          </div>

          {/* Mailing Status / Logs */}
          <div className="bg-cyber-bg/50 border border-gray-800 rounded-xl overflow-hidden min-h-[300px]">
            <div className="px-4 py-3 border-b border-gray-800 bg-black/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Delivery Manifest</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-tighter hidden sm:inline">Last 500 Events</span>
              </div>
              <button 
                onClick={handleClearLogs}
                className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-[10px] hover:bg-red-500/20 transition-all flex items-center gap-1"
                title="Clear all delivery logs"
              >
                <Trash2 size={10} /> Clear Logs
              </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead className="bg-cyber-panel/50 text-gray-500 text-xs">
                   <tr>
                     <th className="px-4 py-2 font-medium">To</th>
                     <th className="px-4 py-2 font-medium">Status</th>
                     <th className="px-4 py-2 font-medium">Time</th>
                     <th className="px-4 py-2 font-medium text-right">Details</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                   {logs.map(log => (
                     <tr key={log.id} className="hover:bg-white/5 transition-colors">
                       <td className="px-4 py-2 text-cyber-text text-xs">{log.recipient}</td>
                       <td className="px-4 py-2">
                         {log.status === 'success' ? (
                           <span className="text-green-400 flex items-center gap-1 text-[10px]"><CheckCircle2 size={12} /> Delivered</span>
                         ) : (
                           <span className="text-red-400 flex items-center gap-1 text-[10px]"><AlertCircle size={12} /> Failed</span>
                         )}
                       </td>
                       <td className="px-4 py-2 text-gray-500 text-[10px]">{new Date(log.sent_at).toLocaleTimeString()}</td>
                       <td className="px-4 py-2 text-right">
                         {log.error ? <span className="text-[10px] text-red-400/70 truncate inline-block max-w-[150px]">{log.error}</span> : <span className="text-gray-600">---</span>}
                       </td>
                     </tr>
                   ))}
                   {logs.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-4 py-12 text-center text-gray-600 italic">No campaign activity recorded yet</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
