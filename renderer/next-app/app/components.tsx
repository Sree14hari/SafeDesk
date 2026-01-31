
function StatusItem({ label, value }: { label: string, value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
             <span style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>{label}</span>
             <span style={{ fontSize: '14px', fontWeight: 800, color: value === 'Clean' || value === 'Empty' || value === '0' ? '#137333' : 'black' }}>
                {value === 'Clean' || value === 'Empty' || value === '0' ? <CheckCircle size={14} style={{verticalAlign:'middle', marginRight:'4px'}}/> : null}
                {value}
             </span>
        </div>
    );
}

function DashboardCard({ label, value, icon }: { label: string, value: string, icon?: any }) {
    return (
        <div className="bh-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {icon && <div style={{ opacity: 0.5 }}>{icon}</div>}
            <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.6 }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>{value}</div>
            </div>
        </div>
    );
}
