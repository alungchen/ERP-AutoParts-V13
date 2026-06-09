const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/pages/PIM/ProductList.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. 插入 expandedStockPid state 宣告
const targetState = `const [showSalesPrices, setShowSalesPrices] = useState(false);`;
const replacementState = `const [showSalesPrices, setShowSalesPrices] = useState(false);
    const [expandedStockPid, setExpandedStockPid] = useState(null);`;

if (content.includes(targetState)) {
    content = content.replace(targetState, replacementState);
    console.log('Successfully added state variable!');
} else {
    console.error('Could not find targetState for state variable!');
}

// 2. 插入 global click hook
const targetHook = `    useEffect(() => {
        useProductStore.getState().fetchProducts();
    }, []);`;

const replacementHook = `    useEffect(() => {
        useProductStore.getState().fetchProducts();
    }, []);

    useEffect(() => {
        if (expandedStockPid === null) return;
        const handleGlobalClick = () => {
            setExpandedStockPid(null);
        };
        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [expandedStockPid]);`;

if (content.includes(targetHook)) {
    content = content.replace(targetHook, replacementHook);
    console.log('Successfully added global click hook!');
} else {
    console.error('Could not find targetHook for global click hook!');
}

// 3. 重新設計的庫存狀態 td 渲染區段
const targetTd = `                                    <td className={styles.tdList}>
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
                                            
                                            return (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={\`text-xs px-2 py-0.5 rounded-sm font-bold \${activeStockBadgeClass}\`} title={\`\${activeBranchName}庫存\`}>
                                                        {activeBranchName}: {activeBranchStockNum}
                                                        <span className={belowSafetyActive ? 'text-danger' : undefined}> 現貨</span>
                                                    </span>
                                                    {activeBranchStockNum > 0 && (
                                                        <span className="text-[10px] text-accent-hover font-mono max-w-[120px] truncate" title={locationSummary}>
                                                            ({locationSummary})
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-muted" title="全分店總計庫存">
                                                        全店總計: <strong style={{ color: 'var(--text-primary)' }}>{totalAllBranches}</strong>
                                                    </span>
                                                    <span className="text-[10px] text-muted font-mono" style={{ fontSize: '9px' }}>安全庫存: {safetyNum}</span>
                                                </div>
                                            );
                                        })()}
                                    </td>`;

const replacementTd = `                                    <td className={styles.tdList} onClick={(e) => e.stopPropagation()}>
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

                                                    {/* 下拉面板 */}
                                                    {isDropdownOpen && (
                                                        <div 
                                                            className="absolute left-0 top-full mt-1.5 w-[220px] bg-bg-secondary border border-border-color rounded-lg shadow-xl p-3 z-[15] backdrop-blur-md"
                                                            style={{ 
                                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)',
                                                                backgroundColor: 'var(--bg-secondary)'
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="text-[10px] font-bold text-muted border-b border-border-color pb-1.5 mb-2 flex items-center justify-between">
                                                                <span>🏢 各分店即時庫存</span>
                                                                <span className="text-primary font-mono font-bold">總計: {totalAllBranches}</span>
                                                            </div>
                                                            <div className="flex flex-col gap-2.5">
                                                                {branches.map(b => {
                                                                    const bStocks = (p.stock_details || []).filter(s => s.branch_id === b.branch_id);
                                                                    const bStockNum = bStocks.reduce((sum, item) => sum + (item.qty || 0), 0);
                                                                    const bLocations = bStocks.length > 0
                                                                        ? bStocks.map(s => \`\${s.location_code}: \${s.qty}\`).join(', ')
                                                                        : '';
                                                                    
                                                                    // 分店專屬小圓點顏色
                                                                    let dotColor = '#3b82f6'; // default songshan blue
                                                                    if (b.branch_id === 'xizhi') dotColor = '#10b981'; // green
                                                                    if (b.branch_id === 'linkou') dotColor = '#f59e0b'; // orange

                                                                    const isCurrentBranch = b.branch_id === activeBranchId;
                                                                    const hasStock = bStockNum > 0;

                                                                    return (
                                                                        <div 
                                                                            key={b.branch_id}
                                                                            className={\`flex flex-col gap-0.5 p-1 rounded \${isCurrentBranch ? 'bg-bg-tertiary border border-border-color/30' : ''}\`}
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                                                                                    <span className={\`text-xs \${hasStock ? 'font-bold text-primary' : 'text-muted'}\`}>
                                                                                        {b.name}
                                                                                        {isCurrentBranch && <span className="text-[9px] text-muted font-normal ml-1">(此店)</span>}
                                                                                    </span>
                                                                                </div>
                                                                                <span className={\`text-xs font-mono font-bold \${hasStock ? 'text-primary' : 'text-muted'}\`}>
                                                                                    {bStockNum}
                                                                                </span>
                                                                            </div>
                                                                            {hasStock && (
                                                                                <div className="text-[10px] text-accent-hover font-mono pl-3.5">
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

// 由於換行符可能是 \r\n，我們把 target 裡的 \n 取代為正則以防萬一，或者直接做兩次替換
const normalize = (str) => str.replace(/\r\n/g, '\n').trim();
const normalizedContent = normalize(content);

const normTargetTd = normalize(targetTd);
const normReplacementTd = normalize(replacementTd);

if (normalizedContent.includes(normTargetTd)) {
    // 為了安全，我們可以直接在原本的 content 中做替換。我們可以把 \r\n 轉成 \n 來處理，最後再存檔（Vite 對換行符無所謂）
    let workingContent = content.replace(/\r\n/g, '\n');
    workingContent = workingContent.replace(normTargetTd, normReplacementTd);
    fs.writeFileSync(targetFile, workingContent, 'utf8');
    console.log('Successfully patched stock td rendering!');
} else {
    // 試試直接用簡單的 regex 或者部分替換
    console.error('Could not find exact targetTd for stock column rendering! Will attempt fallback...');
    // Fallback: 尋找 td 欄位
    // 由於 targetTd 太長，如果其中有空白或換行不匹配，我們可以縮小匹配範圍
}
