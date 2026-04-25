import { useState, useEffect } from 'react';
import { KeyRound, Link, Save, Check } from 'lucide-react';

export default function Settings() {
  const [modelName, setModelName] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [cloudCorrection, setCloudCorrection] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setModelName(localStorage.getItem('stp_model_name') || 'gpt-4o');
    setApiKey(localStorage.getItem('stp_api_key') || '');
    setBaseUrl(localStorage.getItem('stp_base_url') || 'https://api.openai.com/v1');
    setCloudCorrection(localStorage.getItem('stp_cloud_correction') === 'true');
  }, []);

  const handleSave = () => {
    localStorage.setItem('stp_model_name', modelName);
    localStorage.setItem('stp_api_key', apiKey);
    localStorage.setItem('stp_base_url', baseUrl);
    localStorage.setItem('stp_cloud_correction', String(cloudCorrection));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '18px' }}>模型参数设置</h2>

      </div>

      <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            模型名称 (Model)
          </label>
          <input 
            type="text" 
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="如 gemini-3.1-pro 或 gpt-5.2"
            style={{ padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link size={14} color="var(--accent-primary)" /> 接口地址 (Base URL)
          </label>
          <input 
            type="text" 
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={14} color="var(--accent-primary)" /> 接口密钥 (API Key)
          </label>
          <input 
            type="password" 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{ padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }}
          />
        </div>

      </div>

      <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Level 2：云端语义纠偏机制</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={cloudCorrection}
            onChange={(e) => setCloudCorrection(e.target.checked)}
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          启用大语言模型进行相似度矫正 (消耗Token)
        </label>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          开启后如果抽取到无规律的同义词，系统将自动发包请求大模型协助判定，把异形词（如“欢快”）规约至你预设标准范围内（如“正向”）。
        </p>
      </div>

      <div>
        <button className="btn" onClick={handleSave}>
          {saved ? <><Check size={16} /> 保存成功</> : <><Save size={16} /> 保存设置</>}
        </button>
      </div>
    </div>
  );
}
