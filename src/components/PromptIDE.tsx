import { Code2, BookOpen, Plus, Trash2, Database, Lightbulb } from 'lucide-react';

export default function PromptIDE({ sampleData, rules, setRules }: any) {
  const addRule = () => {
    const newRule = {
      id: Math.random().toString(36).substring(7),
      sourceColumn: sampleData?.columns?.[0] || '',
      resultColumn: '',
      instruction: '',
      useDictionary: false,
      dictionaryValues: '',
      strategy: 'exception'
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (index: number, key: string, val: any) => {
    const newRules = [...rules];
    newRules[index][key] = val;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
  };

  const generatePromptPreview = () => {
    if (rules.length === 0) return "暂无提取目标，请先添加提取卡片。";
    
    let prompt = "你是一个专业的数据标注与信息提取专家。请阅读以下提供的各项文本，并严格按照要求提取出对应的核心要素，并以 JSON 格式输出。\\n\\n";
    
    prompt += "【提取要求】\\n";
    rules.forEach((r: any, i: number) => {
      prompt += `${i + 1}. 输出字段名：\`${r.resultColumn || '未命名'}\`\\n`;
      prompt += `   来源文本：从 \`${r.sourceColumn || '未选择'}\` 中提取\\n`;
      prompt += `   提取指令：${r.instruction || '无'}\\n`;
      if (r.useDictionary && r.dictionaryValues) {
        prompt += `   约束白名单：合法值必须为 [${r.dictionaryValues}] 中的一项。如果发现不符合或提取不出，请严格按照策略执行。\\n`;
      }
    });

    prompt += "\\n【待分析文本数据】\\n";
    prompt += "下面是底层提问时，根据对应数据行将被直接插入的文本，而不是使用 {变量} 占位符：\\n\\n";
    const uniqueSources = [...new Set(rules.map((r: any) => r.sourceColumn).filter(Boolean))];
    uniqueSources.forEach((src) => {
      prompt += `[将在此处直接插入来自当前行 '${src}' 列的原始文本片段]\\n`;
    });

    return prompt;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>提取管线构建 (Pipeline Builder)</h2>

        </div>
        <button className="btn" onClick={addRule}>
          <Plus size={16} /> 添加提取目标
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* Rules Builder Area */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '10px' }}>
          {rules.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
              <Lightbulb size={48} opacity={0.2} style={{ marginBottom: '16px' }} />
              <div>点击右上角「添加提取目标」开始设计管线</div>
            </div>
          ) : (
            rules.map((rule: any, i: number) => (
              <div key={rule.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)' }}>提取目标 #{i + 1}</div>
                  <button onClick={() => removeRule(i)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>目标分析列 (数据源)</div>
                    <select 
                      value={rule.sourceColumn} 
                      onChange={e => updateRule(i, 'sourceColumn', e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', outline: 'none' }}
                    >
                      <option value="">-- 请选择源数据列 --</option>
                      {sampleData?.columns?.map((col: string) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>结果输出变量名</div>
                    <input 
                      type="text" 
                      placeholder="例: 情绪指标"
                      value={rule.resultColumn} 
                      onChange={e => updateRule(i, 'resultColumn', e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>判别/提取指令</div>
                  <input 
                    type="text" 
                    placeholder="例: 判断文本传递的是积极情绪还是消极情绪，如果是中立则提取为平淡。"
                    value={rule.instruction} 
                    onChange={e => updateRule(i, 'instruction', e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', outline: 'none' }}
                  />
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <BookOpen size={16} color={rule.useDictionary ? 'var(--success)' : 'var(--text-secondary)'} />
                    <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={rule.useDictionary} 
                        onChange={e => updateRule(i, 'useDictionary', e.target.checked)}
                      />
                      开启特定词典白名单约束
                    </label>
                  </div>
                  
                  {rule.useDictionary && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <input 
                        type="text" 
                        placeholder="合法词汇，用逗号分隔 (如: 积极,消极,平淡)" 
                        value={rule.dictionaryValues} 
                        onChange={e => updateRule(i, 'dictionaryValues', e.target.value)} 
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#fff', outline: 'none', fontSize: '13px' }} 
                      />
                      <select 
                        value={rule.strategy} 
                        onChange={e => updateRule(i, 'strategy', e.target.value)} 
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
                      >
                        <option value="exception">策略：不符时记为异常值 (不中断流程)</option>
                        <option value="regenerate">策略：强制打回要求模型重新生成 (最高3次)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Context */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Database size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>当前数据集状态</span>
            </div>
            {sampleData ? (
              <div style={{ fontSize: '13px', color: 'var(--success)' }}>
                ✅ 已载入包含 {sampleData.columns.length} 个字段的数据集。
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--warning)' }}>
                ⚠️ 尚未载入数据集，请先前往 [数据集导入] 面板。
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.1)' }}>
              <Code2 size={16} color="var(--warning)" /> 
              <span style={{ fontSize: '13px', fontWeight: 600 }}>底层 Prompt 预览 (只读)</span>
            </div>
            <div style={{ 
              flex: 1, 
              padding: '16px', 
              overflowY: 'auto', 
              fontFamily: 'monospace', 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              background: 'rgba(0,0,0,0.3)',
              whiteSpace: 'pre-wrap'
            }}>
              {generatePromptPreview()}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
