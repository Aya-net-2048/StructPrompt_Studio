import { useState } from 'react';
import { Play, CheckCircle2, XCircle, Terminal, FileWarning, Save, Zap } from 'lucide-react';
import { fetch, Body } from '@tauri-apps/api/http';
import { readBinaryFile, writeTextFile } from '@tauri-apps/api/fs';
import { save } from '@tauri-apps/api/dialog';
import Papa from 'papaparse';

export default function RunEvaluation({ sampleSize, rules, filePath }: any) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState({ success: 0, empty: 0, exception: 0 });
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [concurrency, setConcurrency] = useState(parseInt(localStorage.getItem('stp_concurrency') || '1'));

  const addLog = (msg: string) => setLogs(l => [...l, msg]);

  const handleConcurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(1, parseInt(e.target.value) || 1);
    setConcurrency(val);
    localStorage.setItem('stp_concurrency', val.toString());
  };

  const simulateRun = async () => {
    if (sampleSize <= 0) {
      alert("请先在数据导入页设置合理的预实验抽样量");
      return;
    }
    if (!rules || rules.length === 0) {
      alert("尚未建立提取目标，请先前往 [提示词编辑器] 构建管线");
      return;
    }
    if (!filePath) {
      alert("尚未选择数据源文件，请前往 [数据集导入] 面板重新选择");
      return;
    }
    
    const apiKey = localStorage.getItem('stp_api_key');
    const baseUrl = localStorage.getItem('stp_base_url');
    const modelName = localStorage.getItem('stp_model_name');

    if (!apiKey || !baseUrl || !modelName) {
      alert("大模型配置缺失！请前往 [设置] 页面填写接口信息。");
      return;
    }
    
    setRunning(true);
    setProgress(0);
    setProcessedData([]);
    setLogs(['[系统] 正在初始化生产级大模型链路...', `[API] 当前驱动核心: ${modelName}`, `[网络] 当前并发线程数: ${concurrency}`]);
    
    const bytes = await readBinaryFile(filePath);
    let fileContent = '';
    try {
      fileContent = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      fileContent = new TextDecoder('gbk').decode(bytes);
    }
    const parsedData = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const sourceRows = (parsedData.data as any[]).slice(0, sampleSize);
    const limit = sourceRows.length;
    
    addLog(`[系统] 成功装载待提测数据 ${limit} 条。开始执行高并发网络请求池...`);
    setResults({ success: 0, empty: 0, exception: 0 });

    const finalData: any[] = new Array(limit);
    
    // 基础 System Prompt 构建
    let systemPrompt = "你是一个专业的数据标注与信息提取专家。请严格按照要求提取，并必须以纯正的 JSON 格式输出结果，不要附带任何解释性文字、markdown符号或思维链过程。如果实在无法提取，请返回空字符串。\\n\\n【输出规范与字典要求】\\n";
    rules.forEach((r: any, i: number) => {
      systemPrompt += `${i + 1}. 输出字段键名：\`${r.resultColumn || '未命名'}\`\\n`;
      systemPrompt += `   提取依据：${r.instruction || '无'}\\n`;
      if (r.useDictionary && r.dictionaryValues) {
        systemPrompt += `   ⚠️约束白名单：该字段合法值必须且只能为 [${r.dictionaryValues}] 中的一项，若有违背或超出，将被系统直接驳回！\\n`;
      }
    });

    let currentIndex = 0;
    let completedCount = 0;

    const worker = async () => {
      while (currentIndex < limit) {
        // Get index atomically
        const index = currentIndex++;
        const count = index + 1;
        const sourceRow = sourceRows[index];
        const processedRow = { ...sourceRow };
        
        addLog(`[样本 ${count}/${limit}] 正在发起推理请求...`);

        // 提取目标文本
        let userPrompt = "【待分析真实文本】\\n";
        const uniqueSources = [...new Set<string>(rules.map((r: any) => r.sourceColumn).filter(Boolean))];
        uniqueSources.forEach((src) => {
          userPrompt += `数据列 '${src}' 的内容:\\n"""\\n${sourceRow[src] || ''}\\n"""\\n\\n`;
        });
        userPrompt += "请立刻提取并输出 JSON。";

        let messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];

        let retryCount = 0;
        let finalRowStatus = 'success';
        let extractedJSON: any = null;

        while (retryCount <= 3) {
          try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: Body.json({ model: modelName, messages, temperature: 0.1 })
            });
            
            if (!response.ok) {
              addLog(`❌ [样本 ${count}/${limit}] API报错: ${response.status}`);
              finalRowStatus = 'exception';
              break;
            }
            const resData = response.data as any;
            const assistantMsg = resData.choices?.[0]?.message?.content || '';

            // 尝试解析 JSON
            let rawText = assistantMsg.trim();
            if (rawText.startsWith('```json')) {
              rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (rawText.startsWith('```')) {
              rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
            }

            let parsed: any = {};
            try {
              parsed = JSON.parse(rawText);
            } catch (e) {
              addLog(`⚠️ [样本 ${count}/${limit}] JSON 格式破坏，尝试要求重发 (第 ${retryCount+1} 次)`);
              messages.push({ role: 'assistant', content: assistantMsg });
              messages.push({ role: 'user', content: "你输出的不是合法的 JSON 格式。请直接且仅输出合法的 JSON 文本，不要任何 Markdown 标记或多余字符！" });
              retryCount++;
              continue;
            }

            // 白名单字典校验
            let validationError = "";
            let isValid = true;
            let hasEmpty = false;

            for (const rule of rules) {
              const resCol = rule.resultColumn || '未命名提取结果';
              let val = parsed[resCol];
              
              if (val === undefined || val === null || val === '') {
                hasEmpty = true;
              } else if (rule.useDictionary && rule.dictionaryValues) {
                const dict = rule.dictionaryValues.split(/[,，|]/).map((x: string) => x.trim()).filter(Boolean);
                if (!dict.includes(String(val))) {
                  // LLM Secondary Check Correction
                  if (rule.useCorrection) {
                    addLog(`🔍 [样本 ${count}/${limit}] 触发智能语义纠偏: 判断 "${val}" 是否等同于 [${dict.join(',')}] 之一...`);
                    try {
                        const correctionRes = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                            body: Body.json({
                                model: modelName,
                                messages: [
                                    { role: 'system', content: `你是一个语义判定系统。标准词库为 [${dict.join(', ')}]，当前输入为 B。请判断 B 是否是标准词库中某一项的同义词。若是，仅输出该标准词；若不是，仅输出 false。` },
                                    { role: 'user', content: `当前词汇: ${val}` }
                                ],
                                temperature: 0.1
                            })
                        });
                        const cMsg = (((correctionRes.data as any).choices?.[0]?.message?.content) || '').trim();
                        if (dict.includes(cMsg)) {
                            addLog(`✨ [样本 ${count}/${limit}] 纠偏成功: 将 "${val}" 修正为 "${cMsg}"`);
                            parsed[resCol] = cMsg;
                            val = cMsg;
                            continue; // Valid now! Skip exception logic
                        } else {
                            addLog(`⚠️ [样本 ${count}/${limit}] 纠偏失败: 模型判定 "${val}" 与白名单无关。`);
                        }
                    } catch (e) {
                        addLog(`⚠️ [样本 ${count}/${limit}] 纠偏请求异常, 回退常规拦截。`);
                    }
                  }

                  if (rule.strategy === 'regenerate') {
                    isValid = false;
                    validationError += `字段 '${resCol}' 提取的值 '${val}' 属于违规捏造，不在白名单 [${dict.join(', ')}] 中！\\n`;
                  } else {
                    finalRowStatus = 'exception';
                  }
                }
              }
            }

            if (!isValid && retryCount < 3) {
              addLog(`⚠️ [样本 ${count}/${limit}] 触发防幻觉白名单拦截: 正在执行 Regenerate (第 ${retryCount+1} 次)`);
              messages.push({ role: 'assistant', content: assistantMsg });
              messages.push({ role: 'user', content: `严重错误：\\n${validationError}\\n请立即纠正并重新返回完全符合白名单规范的 JSON！` });
              retryCount++;
            } else {
              extractedJSON = parsed;
              if (isValid && finalRowStatus !== 'exception') {
                 finalRowStatus = hasEmpty ? 'empty' : 'success';
              }
              if (!isValid) {
                 finalRowStatus = 'exception';
                 addLog(`❌ [样本 ${count}/${limit}] 超过重试上限，强制记为异常件。`);
              }
              break;
            }
          } catch (globalErr) {
            addLog(`❌ [样本 ${count}/${limit}] 发生崩溃: ${globalErr}`);
            finalRowStatus = 'exception';
            break;
          }
        }

        // 将提取结果贴入数据行
        rules.forEach((rule: any) => {
          const resCol = rule.resultColumn || '未命名提取结果';
          processedRow[resCol] = extractedJSON ? (extractedJSON[resCol] || '') : '模型异常断连';
        });
        
        finalData[index] = processedRow;

        // 统计状态更新
        if (finalRowStatus === 'success') {
          setResults(r => ({ ...r, success: r.success + 1 }));
          addLog(`✅ [样本 ${count}/${limit}] 提取成功：完全合规。`);
        } else if (finalRowStatus === 'empty') {
          setResults(r => ({ ...r, empty: r.empty + 1 }));
          addLog(`⚠️ [样本 ${count}/${limit}] 警告：模型输出了部分空值。`);
        } else {
          setResults(r => ({ ...r, exception: r.exception + 1 }));
          addLog(`❌ [样本 ${count}/${limit}] 归档为格式/字典破裂件。`);
        }

        completedCount++;
        setProgress(Math.round((completedCount / limit) * 100));
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    setProcessedData(finalData);
    setRunning(false);
    addLog('[系统] 真机测评并发执行完毕。可一键导出包含 AI 推理结果的实盘数据。');
  };

  const handleExport = async () => {
    try {
      const savePath = await save({
        filters: [{ name: 'CSV Data', extensions: ['csv'] }],
        defaultPath: 'evaluation_results.csv'
      });
      if (savePath) {
        const csvContent = Papa.unparse(processedData);
        await writeTextFile(savePath, csvContent);
        alert("实盘数据导出成功: " + savePath);
      }
    } catch (e) {
      alert("导出失败: " + e);
    }
  };

  const total = results.success + results.empty + results.exception;
  const passRate = total === 0 ? 0 : Math.round((results.success / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>执行测评 (Production)</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '6px' }}>
             <Zap size={14} color="var(--accent-primary)" />
             <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>并发数:</span>
             <input 
               type="number"
               min={1}
               value={concurrency} 
               onChange={handleConcurrencyChange}
               disabled={running}
               style={{ width: '40px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '13px', textAlign: 'center' }}
             />
          </div>

          <button 
            className="btn" 
            onClick={handleExport}
            disabled={running || processedData.length === 0}
            style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: processedData.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            <Save size={16} /> 导出结果数据
          </button>
          
          <button 
            className="btn" 
            onClick={simulateRun}
            disabled={running}
            style={{ background: running ? 'var(--text-secondary)' : 'var(--success)' }}
          >
            <Play size={16} /> {running ? '多线程处理中...' : '发射生产请求'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> 完美合规数</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>{results.success} <span style={{ fontSize: '16px' }}>({passRate}%)</span></div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto' }}>符合格式与字典白名单</div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--warning)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><FileWarning size={16} /> 空白缺失量</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--warning)' }}>{results.empty}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto' }}>模型回复了字段，但值为空</div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--danger)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><XCircle size={16} /> 异常与破裂量</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--danger)' }}>{results.exception}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 'auto' }}>幻觉编造 / JSON 破裂</div>
        </div>
      </div>

      {/* Logs Terminal */}
      <div style={{ flex: 1, background: '#09090A', border: '1px solid var(--glass-border)', borderRadius: '8px', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)' }}>
          <Terminal size={14} color="var(--text-secondary)" /> <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>核心运行日志 (Production Layer)</span>
          {running && <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--accent-primary)' }}>进度: {progress}%</span>}
        </div>
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px', color: '#A0A0A0', lineHeight: 1.6 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ color: log.includes('❌') ? 'var(--danger)' : log.includes('✅') ? 'var(--success)' : log.includes('⚠️') ? 'var(--warning)' : 'inherit' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
