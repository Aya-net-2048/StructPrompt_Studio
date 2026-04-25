import { useState } from 'react'
import { Database, Beaker, Play, Settings as SettingsIcon } from 'lucide-react'
import DataPool from './components/DataPool'
import PromptIDE from './components/PromptIDE'
import RunEvaluation from './components/RunEvaluation'
import Settings from './components/Settings'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('data')
  
  // Global State
  const [filePath, setFilePath] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<{ columns: string[], rows: any[], totalSize?: string } | null>(null);
  const [sampleSize, setSampleSize] = useState(parseInt(localStorage.getItem('stp_sample_size') || '50'));
  
  // Load Rules
  const [rules, setRules] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('stp_rules') || '[]');
    } catch(e) { return []; }
  });

  const updateRules = (newRules: any[]) => {
    setRules(newRules);
    localStorage.setItem('stp_rules', JSON.stringify(newRules));
  };

  const navItems = [
    { id: 'data', label: '数据集导入', icon: Database },
    { id: 'prompt', label: '提示词编辑器', icon: Beaker },
    { id: 'evaluate', label: '执行测评', icon: Play },
    { id: 'settings', label: '设置', icon: SettingsIcon },
  ];

  return (
    <>
      <div className="titlebar">
        StructPrompt Studio
      </div>
      <div className="app-container">
        <aside className="sidebar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div 
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </div>
            )
          })}
        </aside>

        <main className="main-content">
          <h1 className="page-title">{navItems.find(i => i.id === activeTab)?.label}</h1>
          <div className="glass-panel" style={{ padding: '24px', height: '100%', overflow: 'hidden' }}>
            {activeTab === 'data' && <DataPool filePath={filePath} setFilePath={setFilePath} sampleData={sampleData} setSampleData={setSampleData} sampleSize={sampleSize} setSampleSize={setSampleSize} />}
            {activeTab === 'prompt' && <PromptIDE sampleData={sampleData} rules={rules} setRules={updateRules} />}
            {activeTab === 'evaluate' && <RunEvaluation sampleSize={sampleSize} rules={rules} filePath={filePath} />}
            {activeTab === 'settings' && <Settings />}
          </div>
        </main>
      </div>
    </>
  )
}

export default App
