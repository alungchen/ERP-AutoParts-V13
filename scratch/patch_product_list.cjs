const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/pages/PIM/ProductList.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 統一換行符為 \n
content = content.replace(/\r\n/g, '\n');

// 之前的庫存 td（即我們剛才部署的 dropdown 氣泡版）
const targetTd = `                                    <td className={styles.tdList} onClick={(e) => e.stopPropagation()}>
                                        {(() => {
                                            const activeBranchStocks = (p.stock_details || []).filter(s => s.branch_id === activeBranchId);
                                            const activeBranchStockNum = activeBranchStocks.reduce((sum, item) => sum + (item.qty || 0), 0);
                                            const activeBranchObj = branches.find(b => b.branch_id === activeBranchId);
                                            const activeBranchName = activeBranchObj ? activeBranchObj.name : '當前店';
                                            const locationSummary = activeBranchStocks.length > 0
                                                ? activeBranchStocks.map(s => \`\${s.location_code}: \${s.qty}\`).join(', ')
                                                : '無庫位';
                                            const totalAllBranches = (p.stock_details || []).reduce((sum, item) => sum + (item.qty || 0), 0);
                                            const belowSafetyActive = safetyNum > 0 && activeBranchStockNum < safetyNum;
                                            const activeStockBadgeClass = belowSafetyActive
                                                ? 'bg-danger-subtle text-primary'
                                                : activeBranchStockNum > safetyNum
                                                    ? 'bg-success-subtle text-success'
                                                    : activeBranchStockNum > 0
                                                        ? 'bg-warning-subtle text-warning'
                                                        : 'bg-danger-subtle text-danger';
                                            
                                            const isDropdownOpen = expandedStockPid === p.p_id;

                                            return (
                                                <div className="relative flex flex-col gap-1 items-start">
                                                    <span className={\`text-xs px-2 py-0.5 rounded-sm font-bold \${activeStockBadgeClass}\`} title={\`\${activeBranchName}庫存\`}>
                                                        {activeBranchName}: {activeBranchStockNum}
                                                        <span className={belowSafetyActive ? 'text-danger' : undefined}> 現貨</span>
                                                    </span>
                                                    {activeBranchStockNum > 0 && (
                                                        <span className="text-[10px] text-accent-hover font-mono max-w-[120px] truncate" title={locationSummary}>
                                                            ({locationSummary})
                                                        </span>
                                                    )}
                                                    
                                                    {/* 全店總計按鈕 - 點擊展開其他店庫存 */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedStockPid(isDropdownOpen ? null : p.p_id);
                                                        }}
                                                        className="text-[10px] text-muted hover:text-accent-primary flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer outline-none mt-0.5"
                                                        title="點擊查看各店庫存分佈"
                                                    >
                                                        全店總計: <strong style={{ color: 'var(--text-primary)' }}>{totalAllBranches}</strong>
                                                        <ChevronDown size={10} className={\`transition-transform duration-200 \${isDropdownOpen ? 'rotate-180' : ''}\`} />
                                                    </button>
                                                    
                                                    <span className="text-[10px] text-muted font-mono" style={{ fontSize: '9px' }}>安全庫存: {safetyNum}</span>

                                                    {/* 下拉面板 (已移除標題與總計列，寬度微縮，文字全彩) */}
                                                    {isDropdownOpen && (
                                                        <div 
                                                            className="absolute left-0 top-full mt-1.5 w-[165px] bg-bg-secondary border border-border-color rounded-lg shadow-xl p-2 z-[15] backdrop-blur-md"
                                                            style={{ 
                                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)',
                                                                backgroundColor: 'var(--bg-secondary)'
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="flex flex-col gap-1.5">
                                                                {branches.map(b => {
                                                                    const bStocks = (p.stock_details || []).filter(s => s.branch_id === b.branch_id);
                                                                    const bStockNum = bStocks.reduce((sum, item) => sum + (item.qty || 0), 0);
                                                                    const bLocations = bStocks.length > 0
                                                                        ? bStocks.map(s => \`\${s.location_code}: \${s.qty}\`).join(', ')
                                                                        : '';
                                                                    
                                                                    // 分店主題色配色 (有庫存為飽和色，無庫存為 0.5 不透明度淡色)
                                                                    const hasStock = bStockNum > 0;
                                                                    let bColor = '#3b82f6'; // default songshan blue
                                                                    if (b.branch_id === 'xizhi') bColor = '#10b981'; // green
                                                                    if (b.branch_id === 'linkou') bColor = '#f59e0b'; // orange

                                                                    const displayColor = hasStock ? bColor : \`\${bColor}80\`; // suffix '80' represents 50% opacity in hex

                                                                    const isCurrentBranch = b.branch_id === activeBranchId;

                                                                    return (
                                                                        <div 
                                                                            key={b.branch_id}
                                                                            className={\`flex flex-col gap-0.5 p-1 rounded \${isCurrentBranch ? 'bg-bg-tertiary border border-border-color/30' : ''}\`}
                                                                            style={{ color: displayColor }}
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <span className={\`text-xs font-bold\`}>
                                                                                    {b.name}
                                                                                    {isCurrentBranch && <span className="text-[9px] font-normal ml-1 opacity-70">(此店)</span>}
                                                                                </span>
                                                                                <span className="text-xs font-mono font-bold">
                                                                                    {bStockNum}
                                                                                </span>
                                                                            </div>
                                                                            {hasStock && (
                                                                                <div 
                                                                                    className="text-[9px] font-mono pl-1"
                                                                                    style={{ color: displayColor, opacity: 0.85 }}
                                                                                >
                                                                                    ({bLocations})
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>`;

// 新設計的庫存狀態 td 渲染區段 (直接在下方列表，本店高亮，無安全庫存)
const replacementTd = `                                    <td className={styles.tdList}>
                                        {(() => {
                                            const activeBranchStocks = (p.stock_details || []).filter(s => s.branch_id === activeBranchId);
                                            const activeBranchStockNum = activeBranchStocks.reduce((sum, item) => sum + (item.qty || 0), 0);
                                            const activeBranchObj = branches.find(b => b.branch_id === activeBranchId);
                                            const activeBranchName = activeBranchObj ? activeBranchObj.name : '當前店';
                                            const activeLocationSummary = activeBranchStocks.length > 0
                                                ? activeBranchStocks.map(s => \`\${s.location_code}: \${s.qty}\`).join(', ')
                                                : '無庫位';
                                            const totalAllBranches = (p.stock_details || []).reduce((sum, item) => sum + (item.qty || 0), 0);
                                            const belowSafetyActive = safetyNum > 0 && activeBranchStockNum < safetyNum;
                                            
                                            // 本店的 Badge 樣式 (庫存不足為紅色警告，正常為當前分店主題高亮色)
                                            const activeStockBadgeClass = belowSafetyActive
                                                ? 'bg-danger-subtle text-primary border border-danger/25'
                                                : activeBranchStockNum > safetyNum
                                                    ? 'bg-success-subtle text-success border border-success/20'
                                                    : activeBranchStockNum > 0
                                                        ? 'bg-warning-subtle text-warning border border-warning/20'
                                                        : 'bg-danger-subtle text-danger border border-danger/10';

                                            return (
                                                <div className="flex flex-col gap-1 items-start min-w-[130px]">
                                                    {/* 1. 本店高亮顯示 */}
                                                    <div className="flex flex-col items-start p-1.5 bg-bg-tertiary/40 rounded border border-border-color/30 w-full mb-1">
                                                        <span className={\`text-xs px-2 py-0.5 rounded-sm font-bold \${activeStockBadgeClass}\`}>
                                                            {activeBranchName}: {activeBranchStockNum}
                                                            <span className={belowSafetyActive ? 'text-danger' : undefined}> 現貨</span>
                                                        </span>
                                                        {activeBranchStockNum > 0 && (
                                                            <span className="text-[10px] text-accent-hover font-mono pl-1 mt-0.5">
                                                                ({activeLocationSummary})
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* 2. 其他分店直接顯示在下方 */}
                                                    <div className="flex flex-col gap-1 pl-1.5 w-full">
                                                        {branches.filter(b => b.branch_id !== activeBranchId).map(b => {
                                                            const bStocks = (p.stock_details || []).filter(s => s.branch_id === b.branch_id);
                                                            const bStockNum = bStocks.reduce((sum, item) => sum + (item.qty || 0), 0);
                                                            const bLocations = bStocks.length > 0
                                                                ? bStocks.map(s => \`\${s.location_code}: \${s.qty}\`).join(', ')
                                                                : '';
                                                            
                                                            const hasStock = bStockNum > 0;
                                                            let bColor = '#3b82f6'; // default songshan blue
                                                            if (b.branch_id === 'xizhi') bColor = '#10b981'; // green
                                                            if (b.branch_id === 'linkou') bColor = '#f59e0b'; // orange

                                                            const displayColor = hasStock ? bColor : \`\${bColor}80\`; // 50% opacity for no stock

                                                            return (
                                                                <div 
                                                                    key={b.branch_id}
                                                                    className="flex flex-col gap-0.5"
                                                                    style={{ color: displayColor }}
                                                                >
                                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                                        <span className="font-semibold">{b.name}:</span>
                                                                        <span className="font-mono font-bold">{bStockNum}</span>
                                                                    </div>
                                                                    {hasStock && (
                                                                        <div 
                                                                            className="text-[9px] font-mono pl-1"
                                                                            style={{ color: displayColor, opacity: 0.85 }}
                                                                        >
                                                                            ({bLocations})
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* 3. 全店總計 */}
                                                    <div className="text-[10px] text-muted border-t border-border-color/40 w-full pt-1 mt-1 pl-1.5">
                                                        全店總計: <strong style={{ color: 'var(--text-primary)' }}>{totalAllBranches}</strong>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>`;

const normTargetTd = targetTd.replace(/\r\n/g, '\n').trim();
const normReplacementTd = replacementTd.replace(/\r\n/g, '\n').trim();

if (content.includes(normTargetTd)) {
    content = content.replace(normTargetTd, normReplacementTd);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched PIM stock rendering to static straight list!');
} else {
    console.error('Could not find normTargetTd! Try fallback matching.');
}
