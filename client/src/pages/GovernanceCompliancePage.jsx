import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  FileText, 
  WalletCards, 
  CheckSquare, 
  BookOpen, 
  Link, 
  BarChart3, 
  Search, 
  AlertTriangle, 
  ChevronRight, 
  Calendar,
  CheckCircle,
  FileSpreadsheet,
  Plus
} from 'lucide-react';

export default function GovernanceCompliancePage({ activeTab = 'safeguarding' }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'safeguarding', label: 'Safeguarding', icon: ShieldCheck, color: 'text-rose-400 border-rose-500 bg-rose-500/10' },
    { id: 'volunteers', label: 'Volunteer Management', icon: Users, color: 'text-amber-400 border-amber-500 bg-amber-500/10' },
    { id: 'donors', label: 'Donor Compliance', icon: FileText, color: 'text-teal-400 border-teal-500 bg-teal-500/10' },
    { id: 'grants', label: 'Grant Management', icon: WalletCards, color: 'text-indigo-400 border-indigo-500 bg-indigo-500/10' },
    { id: 'supervision', label: 'Supervision', icon: CheckSquare, color: 'text-sky-400 border-sky-500 bg-sky-500/10' },
    { id: 'knowledge-hub', label: 'Knowledge Hub', icon: BookOpen, color: 'text-emerald-400 border-emerald-500 bg-emerald-500/10' },
    { id: 'referrals', label: 'Referral Governance', icon: Link, color: 'text-purple-400 border-purple-500 bg-purple-500/10' },
    { id: 'performance', label: 'Performance & KPIs', icon: BarChart3, color: 'text-fuchsia-400 border-fuchsia-500 bg-fuchsia-500/10' },
  ];

  const handleTabChange = (tabId) => {
    navigate(`/governance/${tabId}`);
  };

  // Mock Premium Demo Data for the 8 sub-modules
  const demoData = {
    safeguarding: {
      stats: [
        { label: 'Active Incidents', value: '2 Pending Escalation', badgeColor: 'bg-rose-500/20 text-rose-400' },
        { label: 'Compliance Audit Score', value: '100% Verified', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Staff Trainings completed', value: '42 of 45 Officers', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
      ],
      incidents: [
        { id: 'SG-2026-08', type: 'Clinical Adherence Risk', clientCode: 'ZW-BYO-021', date: '2026-05-18', priority: 'HIGH', status: 'Escalated to Director', description: 'Repeated unsuppressed viral load with missed buddy visits.' },
        { id: 'SG-2026-07', type: 'Community Support Gap', clientCode: 'ZW-BYO-144', date: '2026-05-15', priority: 'MEDIUM', status: 'Investigating', description: 'Defaulter home-visit tracing reports logistic constraints.' },
      ],
    },
    volunteers: {
      stats: [
        { label: 'Active Facilitators', value: '28 Peer Educators', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Pending Onboarding', value: '3 Facilitators', badgeColor: 'bg-amber-500/20 text-amber-400' },
        { label: 'Average Cases / Facilitator', value: '5.2 Clients', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
      ],
      roster: [
        { name: 'Lorraine', email: 'lorraine@mmpzim.org.zw', role: 'Youth Facilitator / Peer Educator', district: 'Bulawayo', cases: 6, status: 'Active' },
        { name: 'Tanaka', email: 'tanaka@mmpzim.org.zw', role: 'Youth Facilitator / Peer Educator', district: 'Bulawayo', cases: 5, status: 'Active' },
        { name: 'Freddy', email: 'freddy@mmpzim.org.zw', role: 'Youth Facilitator / Peer Educator', district: 'Harare', cases: 4, status: 'Pending Review' },
      ],
    },
    donors: {
      stats: [
        { label: 'Active Core Donors', value: '4 Partners', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Compliance Reports Due', value: '1 in next 30 days', badgeColor: 'bg-amber-500/20 text-amber-400' },
        { label: 'Financial Audit Rating', value: 'Clean Bill (A+)', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
      ],
      requirements: [
        { id: 'DON-01', donorName: 'USAID / PEPFAR', project: 'Youth Adherence Care', reportType: 'Semi-Annual Clinical Summary', deadline: '2026-06-15', status: 'In Compilation', progress: 75 },
        { id: 'DON-02', donorName: 'Global Fund', project: 'SRHR Key Population Support', reportType: 'Quarterly Output Roster', deadline: '2026-06-30', status: 'Not Started', progress: 10 },
      ],
    },
    grants: {
      stats: [
        { label: 'Total Grant Pool', value: '$245,000 USD', badgeColor: 'bg-teal-500/20 text-teal-400' },
        { label: 'Overall Burn Rate', value: '62.4%', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Remaining Cash Reserve', value: '$92,120 USD', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
      ],
      grantsList: [
        { name: 'PEPFAR Adherence Grant ZW-098', allocation: 150000, spend: 98400, balance: 51600, burn: 65.6, status: 'ON TRACK' },
        { name: 'Global Fund SRHR Outreach', allocation: 95000, spend: 54600, balance: 40400, burn: 57.5, status: 'ON TRACK' },
      ],
    },
    supervision: {
      stats: [
        { label: 'Case Reviews Conducted', value: '14 This Month', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Action Items Pending', value: '4 Escalations', badgeColor: 'bg-rose-500/20 text-rose-400' },
        { label: 'Next Joint Audit', value: 'May 25, 2026', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
      ],
      actions: [
        { id: 'SUP-421', type: 'Clinical Case Audit', auditor: 'Programs & M&E Officer', subject: 'Facilitator Adherence Checklist Review', date: '2026-05-19', status: 'Completed', notes: 'Validated outcome harvesting logs for 4 peer educators. Output aligns with targets.' },
        { id: 'SUP-422', type: 'Offline Sync Reconciliation', auditor: 'MEL Officer', subject: 'Correction Inbox Submissions', date: '2026-05-18', status: 'Action Required', notes: 'Correction items returned for Tanaka\'s logsheet. Needs facilitator revision.' },
      ],
    },
    'knowledge-hub': {
      stats: [
        { label: 'Approved SOP Documents', value: '18 Protocols', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Documentation Downloads', value: '142 Registers', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Updates Pending Approval', value: '2 SOP Revisions', badgeColor: 'bg-amber-500/20 text-amber-400' },
      ],
      documents: [
        { title: 'Standard Operating Procedures for Defaulter Tracing', code: 'MMPZ-SOP-012', version: 'v3.1', approvedDate: '2026-02-14', status: 'Active', category: 'Field Manuals' },
        { title: 'Clinical Safeguarding and PII Guidelines', code: 'MMPZ-SOP-005', version: 'v4.0', approvedDate: '2026-04-01', status: 'Active', category: 'Compliance' },
        { title: 'Youth Buddy System Interaction Logsheet Template', code: 'MMPZ-SOP-019', version: 'v1.2', approvedDate: '2026-05-10', status: 'Active', category: 'Templates' },
      ],
    },
    referrals: {
      stats: [
        { label: 'Referrals Linkages Logged', value: '45 Active Linkages', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Linkage Success Rate', value: '91.1%', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Clinic Follow-Ups Pending', value: '4 Cases', badgeColor: 'bg-amber-500/20 text-amber-400' },
      ],
      referralsList: [
        { clientCode: 'ZW-BYO-021', destinationClinic: 'Bulawayo General Clinic', referralReason: 'Adherence and Viral Load Review', dateReferred: '2026-05-10', successStatus: 'Confirmed', verifiedBy: 'SRHR Officer' },
        { clientCode: 'ZW-BYO-108', destinationClinic: 'Mpilo Opportunity Clinic', referralReason: 'Psychosocial Counseling support', dateReferred: '2026-05-14', successStatus: 'Pending Verification', verifiedBy: 'System Administrator' },
        { clientCode: 'ZW-BYO-144', destinationClinic: 'Magwegwe Poly Clinic', referralReason: 'ART Regimen Swapping', dateReferred: '2026-05-17', successStatus: 'Confirmed', verifiedBy: 'SRHR Officer' },
      ],
    },
    performance: {
      stats: [
        { label: 'Target Completion Rate', value: '87.5% Average', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Active KPI Metrics', value: '12 Operational Ind.', badgeColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Supervisors Review Complete', value: '9 of 11 Officers', badgeColor: 'bg-teal-500/20 text-teal-400' },
      ],
      kpis: [
        { metric: 'Longitudinal Adherence (90% Suppression Target)', goal: '95.0%', actual: '92.4%', variance: '-2.6%', status: 'ACCOMPLISHED' },
        { metric: 'Defaulter Tracing Conversion Rate (Ret. to care)', goal: '80.0%', actual: '85.2%', variance: '+5.2%', status: 'EXCEEDED' },
        { metric: 'Volunteer Logsheet Validation Accuracy', goal: '100.0%', actual: '98.5%', variance: '-1.5%', status: 'NEEDS_IMPROVEMENT' },
      ],
    },
  };

  const activeTabContent = demoData[activeTab];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 mb-1">
            <ShieldCheck size={20} />
            <span className="text-sm font-semibold tracking-wider uppercase">MMPZ Strategic Governance</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Governance & Compliance Center
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Authoritative platform for monitoring cross-system QA, donor expectations, legal compliance, and field operations.
          </p>
        </div>
        
        {/* Search */}
        <div className="mt-4 md:mt-0 relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search governance logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Main Tabbed Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Navigation (Glassmorphic Sidebar) */}
        <div className="lg:col-span-1 space-y-2 bg-slate-900/40 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-lg">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Compliance Modules</h2>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 text-left ${
                  isActive 
                    ? `${tab.color} font-bold shadow-lg border border-slate-700/50` 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={18} className={isActive ? '' : 'text-slate-500'} />
                  <span className="text-sm">{tab.label}</span>
                </div>
                <ChevronRight size={14} className={isActive ? 'opacity-100' : 'opacity-0'} />
              </button>
            );
          })}
        </div>

        {/* Right Content Section */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Active Tab Stats Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeTabContent.stats.map((stat, index) => (
              <div key={index} className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md shadow-md flex flex-col justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</span>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg md:text-xl font-bold tracking-tight text-white">{stat.value}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stat.badgeColor}`}>Active</span>
                </div>
              </div>
            ))}
          </div>

          {/* Module-Specific Render Engine */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-lg shadow-xl min-h-[450px]">
            
            {/* SAFEGUARDING TAB */}
            {activeTab === 'safeguarding' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Active Safeguarding & Escalation Logs</h3>
                    <p className="text-slate-400 text-xs mt-0.5">High-priority clinical safety concerns escalated directly from the mobile capture sync.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs hover:bg-rose-500/30 transition-all duration-300">
                    <AlertTriangle size={14} />
                    <span>Escalate Incident</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Case ID</th>
                        <th className="py-3 px-4">Incident Type</th>
                        <th className="py-3 px-4">Client</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabContent.incidents.map((incident) => (
                        <tr key={incident.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-sm">
                          <td className="py-4 px-4 font-mono font-semibold text-rose-400">{incident.id}</td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-slate-200">{incident.type}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{incident.description}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-300">{incident.clientCode}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              incident.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{incident.priority}</span>
                          </td>
                          <td className="py-4 px-4 text-slate-400 text-xs">{incident.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VOLUNTEER MANAGEMENT TAB */}
            {activeTab === 'volunteers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Youth Facilitators & Peer Educators</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Offline field staff onboarding checklists, case logs and sync audits.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs transition-all duration-300">
                    <Plus size={14} />
                    <span>Onboard Facilitator</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Facilitator Name</th>
                        <th className="py-3 px-4">District</th>
                        <th className="py-3 px-4">Assigned Cases</th>
                        <th className="py-3 px-4">Role Title</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabContent.roster.map((v, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-sm">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-semibold text-slate-200">{v.name}</p>
                              <p className="text-xs text-slate-500">{v.email}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-300">{v.district}</td>
                          <td className="py-4 px-4 font-medium text-indigo-400">{v.cases} Clients</td>
                          <td className="py-4 px-4 text-slate-400 text-xs">{v.role}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              v.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{v.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DONOR COMPLIANCE TAB */}
            {activeTab === 'donors' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Donor Compliance & Requirements</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Tracking reporting deadlines, semi-annual metrics, and regulatory checks.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-teal-500/20 text-teal-400 border border-teal-500/30 px-3 py-1.5 rounded-xl text-xs hover:bg-teal-500/30 transition-all duration-300">
                    <FileSpreadsheet size={14} />
                    <span>Export Compliance Sheet</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {activeTabContent.requirements.map((req) => (
                    <div key={req.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded">{req.id}</span>
                          <span className="font-semibold text-slate-200">{req.donorName}</span>
                          <span className="text-xs text-slate-500">| Project: {req.project}</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-2 font-medium">{req.reportType}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Calendar size={12} className="text-slate-500" />
                          <span className="text-xs text-slate-500">Deadline: {req.deadline}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between min-w-[200px]">
                        <span className="text-xs text-slate-400 mb-1.5 font-medium">{req.status} ({req.progress}%)</span>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-teal-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${req.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GRANT MANAGEMENT TAB */}
            {activeTab === 'grants' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Grant Allocation & Financial Monitoring</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Tracking current budget distributions, expenditures, and allocation burn rates.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs hover:bg-indigo-500/30 transition-all duration-300">
                    <CheckCircle size={14} />
                    <span>Audit New Budget</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTabContent.grantsList.map((grant, i) => (
                    <div key={i} className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-slate-200 text-sm md:text-base leading-tight">{grant.name}</h4>
                          <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400">{grant.status}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-xs md:text-sm">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Allocated</span>
                            <span className="font-semibold text-slate-300">${grant.allocation.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Spent</span>
                            <span className="font-semibold text-slate-300">${grant.spend.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Balance</span>
                            <span className="font-bold text-indigo-400">${grant.balance.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-slate-500 font-medium">Allocation Burn Rate</span>
                          <span className="font-semibold text-indigo-400">{grant.burn}%</span>
                        </div>
                        <div className="bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${grant.burn}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUPERVISION TAB */}
            {activeTab === 'supervision' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Supervision Logs & Quality Assurance</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Tracking manager check-ins, case study reviews, and offline sync rectifications.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 px-3 py-1.5 rounded-xl text-xs hover:bg-sky-500/30 transition-all duration-300">
                    <CheckSquare size={14} />
                    <span>Log Review Session</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Audit ID</th>
                        <th className="py-3 px-4">Supervision Type</th>
                        <th className="py-3 px-4">Subject Reviewed</th>
                        <th className="py-3 px-4">Auditor</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabContent.actions.map((act) => (
                        <tr key={act.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-sm">
                          <td className="py-4 px-4 font-mono text-sky-400 font-semibold">{act.id}</td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-semibold text-slate-200">{act.type}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{act.notes}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-300">{act.subject}</td>
                          <td className="py-4 px-4 text-slate-400 text-xs">{act.auditor}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              act.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>{act.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* KNOWLEDGE HUB TAB */}
            {activeTab === 'knowledge-hub' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Knowledge Hub Governance</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Approved Standard Operating Procedures (SOPs), manuals, and reference guidelines.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs transition-all duration-300">
                    <Plus size={14} />
                    <span>Upload SOP Document</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Document Title</th>
                        <th className="py-3 px-4">Reference Code</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Approved Date</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabContent.documents.map((doc, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-sm">
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-semibold text-slate-200">{doc.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Version: {doc.version}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-mono text-emerald-400 font-semibold text-xs">{doc.code}</td>
                          <td className="py-4 px-4 text-slate-300 text-xs">{doc.category}</td>
                          <td className="py-4 px-4 text-slate-400 text-xs">{doc.approvedDate}</td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400">{doc.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REFERRAL GOVERNANCE TAB */}
            {activeTab === 'referrals' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Clinical Linkages & Referral Auditing</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Monitoring referral success rates and medical facility support linkages.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs hover:bg-purple-500/30 transition-all duration-300">
                    <Link size={14} />
                    <span>Audit Clinic Connection</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 px-4">Client Code</th>
                        <th className="py-3 px-4">Destination Clinic</th>
                        <th className="py-3 px-4">Referral Reason</th>
                        <th className="py-3 px-4">Logged Date</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTabContent.referralsList.map((ref, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-sm">
                          <td className="py-4 px-4 font-mono text-purple-400 font-semibold">{ref.clientCode}</td>
                          <td className="py-4 px-4 font-semibold text-slate-200">{ref.destinationClinic}</td>
                          <td className="py-4 px-4 text-slate-300 text-xs">
                            <div>
                              <p className="font-medium">{ref.referralReason}</p>
                              <p className="text-slate-500 mt-0.5">Audited by: {ref.verifiedBy}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-400 text-xs">{ref.dateReferred}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              ref.successStatus === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'
                            }`}>{ref.successStatus}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PERFORMANCE & KPIS TAB */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Staff KPIs & Operational Targets</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Longitudinal goal matrices, conversion targets, and performance quality scoring.</p>
                  </div>
                  <button className="flex items-center space-x-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-3 py-1.5 rounded-xl text-xs transition-all duration-300">
                    <BarChart3 size={14} />
                    <span>Configure Target Goals</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {activeTabContent.kpis.map((kpi, i) => (
                    <div key={i} className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="md:w-1/2">
                        <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">Operational Target Indicator</span>
                        <h4 className="font-bold text-slate-200 text-sm md:text-base leading-tight mt-1">{kpi.metric}</h4>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Goal</span>
                          <span className="font-semibold text-slate-300 text-sm">{kpi.goal}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Actual</span>
                          <span className="font-bold text-slate-100 text-sm">{kpi.actual}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Variance</span>
                          <span className={`font-bold text-sm ${kpi.variance.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {kpi.variance}
                          </span>
                        </div>
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            kpi.status === 'EXCEEDED' ? 'bg-emerald-500/20 text-emerald-400' :
                            kpi.status === 'ACCOMPLISHED' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>{kpi.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
