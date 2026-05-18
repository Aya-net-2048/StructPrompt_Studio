import { useState } from 'react';
import { Database, FileText, TableProperties } from 'lucide-react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';

export default function DataPool({ filePath, setFilePath, sampleData, setSampleData, sampleSize, setSampleSize }: any) {
  const [loading, setLoading] = useState(false);

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setSampleSize(val);
    localStorage.setItem('stp_sample_size', val.toString());
  };

  const handleImport = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Data Files', extensions: ['csv', 'xlsx', 'xls'] }]
      });
      
      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        setLoading(true);
        
        try {
          const parsedData: any = await invoke('parse_dataset', { path: selected, limit: 15 });
          
          setSampleData({
            columns: parsedData.columns || [],
            rows: parsedData.rows || [],
            totalSize: parsedData.total_size
          });
        } catch (err) {
          alert("解析文件失败: " + err);
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      alert("Error opening file: " + e);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>数据集导入</h2>

        </div>
        <button className="btn" onClick={handleImport} disabled={loading}>
          <Database size={16} /> 
          {loading ? '解析中...' : '选择文件'}
        </button>
      </div>

      {filePath && (
        <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}>
          <FileText size={16} color="var(--accent-primary)" />
          <span style={{ color: 'var(--text-secondary)' }}>已选中文件:</span>
          <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{filePath}</span>
          {sampleData?.totalSize && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>文件大小: {sampleData.totalSize}</span>
          )}
        </div>
      )}

      {sampleData && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>提取数据属性 (检测到 {sampleData.columns.length} 个字段)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sampleData.columns.map((col: any) => (
                <span key={col} style={{ background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {col}
                </span>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>预实验抽样量设置</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
              <input 
                type="number" 
                value={sampleSize}
                onChange={handleSizeChange}
                style={{ width: '80px', padding: '6px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', outline: 'none' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>条记录参与测算</span>
            </div>
          </div>
        </div>
      )}

      {sampleData && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '8px 12px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--glass-border)' }}>
            <TableProperties size={14} /> 数据预览（前 15 行）
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr>
                  {sampleData.columns.map((col: string) => (
                    <th key={col} style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--glass-border)', color: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleData.rows.map((row: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    {sampleData.columns.map((col: string) => (
                      <td key={col} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {String(row[col] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!sampleData && filePath && !loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          流式读取处理中...
        </div>
      )}

      {!filePath && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', flexDirection: 'column', gap: '12px' }}>
          <Database size={48} opacity={0.2} />
          <div style={{ color: 'var(--text-secondary)' }}>尚未加载数据集</div>
        </div>
      )}
    </div>
  );
}
