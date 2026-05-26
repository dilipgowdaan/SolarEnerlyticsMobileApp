import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, SafeAreaView, StatusBar, Alert, ActivityIndicator 
} from 'react-native';
import { 
  Zap, Sun, Battery, Activity, ArrowRightLeft, 
  DollarSign, LogOut, CheckCircle2, ShieldAlert, List, 
  AlertTriangle, Shield, Phone, Mail, LifeBuoy, User
} from 'lucide-react-native';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://aodfguenuwdpymkbwzwn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvZGZndWVudXdkcHlta2J3enduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDYyMzksImV4cCI6MjA5MzUyMjIzOX0.M4_I7a0--FaVN1RPoNVrGb6iIFYz24xM-_jOaosysIk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (uid, email) => {
    const { data: userDoc } = await supabase.from('users').select('*').eq('uid', uid).single();
    if (userDoc) {
      setUser(userDoc);
    } else {
      setUser({ uid, email, role: 'user', dataType: 'sim', name: 'Unknown Client', espId: '' });
    }
    setAuthLoading(false);
  };

  const handleLogin = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
         if (email === 'dilipgowda7259@gmail.com' && error.message.includes("Invalid login")) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) throw signUpError;
            
            await supabase.from('users').insert({ 
              uid: signUpData.user.id, name: 'System Admin', email, mobile: '0000000000', location: 'Headquarters', role: 'admin', dataType: 'sim', espId: '' 
            });
            setUser({ uid: signUpData.user.id, email, role: 'admin', dataType: 'sim', name: 'System Admin', espId: '' });
            return;
         }
         throw error;
      }
      await fetchUserProfile(data.user.id, email);
    } catch (err) { 
      Alert.alert("Error", err.message); 
    }
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#09090E" />
      {!user ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <DashboardScreen 
          user={user} 
          onLogout={() => supabase.auth.signOut()} 
        />
      )}
    </SafeAreaView>
  );
}

// --- LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('dilipgowda7259@gmail.com');
  const [password, setPassword] = useState('RVCE@1234');
  const [loading, setLoading] = useState(false);

  const onSubmit = () => {
    setLoading(true);
    onLogin(email, password).finally(() => setLoading(false));
  };

  return (
    <View style={styles.loginContainer}>
      <View style={styles.iconWrapper}>
        <Zap color="#10b981" size={40} strokeWidth={2.5} />
      </View>
      <Text style={styles.title}>Enerlytics Mobile</Text>
      <Text style={styles.subtitle}>Client Edge Portal</Text>

      <View style={styles.formContainer}>
        <Text style={styles.inputLabel}>Secure Email</Text>
        <TextInput 
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#64748b"
        />

        <Text style={styles.inputLabel}>Authentication PIN</Text>
        <TextInput 
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#64748b"
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={onSubmit} 
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Access Grid</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// --- DASHBOARD SCREEN ---
const DashboardScreen = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('1h');
  const [adminInfo, setAdminInfo] = useState({ name: 'System Admin', mobile: '+91 0000000000', email: 'dilipgowda7259@gmail.com' });
  
  const [liveData, setLiveData] = useState({
    solar: { power: 0, voltage: 0, current: 0 },
    battery: { percentage: 0, voltage: 0, temp: 29.0 },
    load: { power: 0 },
    grid: { importExport: 0, voltage: 12.0, active: true },
    relays: { r1: false, r2: false, mode: 'auto' },
    billing: { imported: 0, exported: 0 }
  });
  
  const TARIFF = { BUY: 0.15, SELL: 0.05 };

  useEffect(() => {
    if (!user.espId && user.dataType === 'real') return;
    const deviceId = user.dataType === 'real' ? user.espId : `sim_${user.uid}`;
    
    // Initial fetch
    supabase.from('devices').select('*').eq('id', deviceId).single().then(({data}) => {
      if(data) {
        setLiveData({
          solar: { power: data.solar_power??0, voltage: data.solar_voltage??0, current: data.solar_current??0 }, 
          battery: { percentage: data.battery_percentage??0, voltage: data.battery_voltage??0, temp: data.battery_temp??29.0 }, 
          load: { power: data.load_power??0 }, 
          grid: { importExport: data.grid_import_export??0, voltage: data.grid_voltage??12.0, active: data.grid_active??true }, 
          relays: { r1: data.relay_r1, r2: data.relay_r2, mode: data.relay_mode }, 
          billing: { imported: data.billing_imported??0, exported: data.billing_exported??0 }
        });
      }
    });
    
    supabase.from('history').select('*').eq('device_id', deviceId).order('id', {ascending: false}).limit(3000).then(({data}) => {
      if(data) {
        setHistory(data.map(raw => { 
          const t = parseInt(raw.id); 
          const d = new Date(t); 
          const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          const tStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

          return { 
            id: t, 
            timestamp: `${dStr}, ${tStr}`, 
            solarV: (parseFloat(raw.solarV)||0).toFixed(1), 
            solarI: (parseFloat(raw.solarI)||0).toFixed(1), 
            solarP: (parseFloat(raw.solarP)||0).toFixed(1), 
            batteryPct: parseInt(raw.batteryPct)||0, 
            loadP: (parseFloat(raw.loadP)||0).toFixed(1), 
            gridStatus: (parseFloat(raw.gridExport)||0)<0 ? 'Exporting':'Importing' 
          }; 
        }));
      }
    });

    // Fetch Admin Details
    supabase.from('users').select('*').eq('role', 'admin').limit(1).single().then(({data}) => {
      if(data) setAdminInfo(data);
    });

    // Real-time subscriptions
    const subDev = supabase.channel('mobile-devices').on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `id=eq.${deviceId}` }, (payload) => {
      const data = payload.new; 
      if(data) {
        setLiveData({
          solar: { power: data.solar_power??0, voltage: data.solar_voltage??0, current: data.solar_current??0 }, 
          battery: { percentage: data.battery_percentage??0, voltage: data.battery_voltage??0, temp: data.battery_temp??29.0 }, 
          load: { power: data.load_power??0 }, 
          grid: { importExport: data.grid_import_export??0, voltage: data.grid_voltage??12.0, active: data.grid_active??true }, 
          relays: { r1: data.relay_r1, r2: data.relay_r2, mode: data.relay_mode }, 
          billing: { imported: data.billing_imported??0, exported: data.billing_exported??0 }
        });
      }
    }).subscribe();

    const subHist = supabase.channel('mobile-history').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history', filter: `device_id=eq.${deviceId}` }, (payload) => {
      const raw = payload.new; 
      if(raw) { 
        const t = parseInt(raw.id); 
        const d = new Date(t); 
        const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const tStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        const newHistRecord = { 
          id: t, 
          timestamp: `${dStr}, ${tStr}`, 
          solarV: (parseFloat(raw.solarV)||0).toFixed(1), 
          solarI: (parseFloat(raw.solarI)||0).toFixed(1), 
          solarP: (parseFloat(raw.solarP)||0).toFixed(1), 
          batteryPct: parseInt(raw.batteryPct)||0, 
          loadP: (parseFloat(raw.loadP)||0).toFixed(1), 
          gridStatus: (parseFloat(raw.gridExport)||0)<0 ? 'Exporting':'Importing' 
        };
        setHistory(prev => [newHistRecord, ...prev].slice(0,3000)); 
      }
    }).subscribe();

    // 3. Simulator Engine
    if (user.dataType === 'sim') {
      let tickCount = 0;
      let lastTime = Date.now();

      const simInterval = setInterval(() => {
        tickCount++;
        const simTime = Date.now();
        const deltaHours = (simTime - lastTime) / 3600000.0;
        lastTime = simTime;

        setLiveData(prev => {
          let newBat = prev.battery.percentage;
          if (!prev.relays.r2) newBat += 0.8; 
          if (prev.relays.r1) newBat -= 0.5; 
          newBat = Math.max(0, Math.min(100, newBat)); 
          
          const newSolarP = Math.max(0, prev.solar.power + (Math.random() * 2 - 1));
          const newLoadP = Math.max(10, 20 + (Math.random() * 2 - 1));
          
          const gridExp = (prev.relays.r1 ? 0 : newLoadP) - (prev.relays.r2 ? newSolarP : 0);
          
          const addedImport = gridExp > 0 ? (gridExp * deltaHours) / 1000.0 : 0;
          const addedExport = gridExp < 0 ? (Math.abs(gridExp) * deltaHours) / 1000.0 : 0;
          const newImportTotal = prev.billing.imported + addedImport;
          const newExportTotal = prev.billing.exported + addedExport;
          
          const simGridVolts = 12.0 + (Math.random() * 0.4 - 0.2);

          supabase.from('devices').upsert({
            id: deviceId, 
            timestamp: Math.floor(simTime / 1000), 
            solar_power: newSolarP, 
            solar_voltage: prev.solar.voltage, 
            solar_current: prev.solar.current,
            battery_percentage: newBat, 
            battery_voltage: prev.battery.voltage, 
            battery_temp: prev.battery.temp,
            load_power: newLoadP,
            grid_import_export: gridExp, 
            grid_voltage: simGridVolts,
            grid_active: true,
            billing_imported: newImportTotal, 
            billing_exported: newExportTotal,
            relay_r1: prev.relays.r1, 
            relay_r2: prev.relays.r2, 
            relay_mode: prev.relays.mode
          }).then();

          const timeMsStr = simTime.toString();
          supabase.from('history').insert({
            id: timeMsStr, 
            device_id: deviceId, 
            solarV: prev.solar.voltage, 
            solarI: prev.solar.current,
            solarP: newSolarP, 
            batteryPct: newBat, 
            loadP: newLoadP, 
            gridExport: gridExp
          }).then();

          return { 
            ...prev, 
            timestamp: simTime, 
            solar: { ...prev.solar, power: newSolarP }, 
            battery: { ...prev.battery, percentage: newBat }, 
            load: { ...prev.load, power: newLoadP }, 
            grid: { importExport: gridExp, voltage: simGridVolts, active: true }, 
            billing: { imported: newImportTotal, exported: newExportTotal } 
          };
        });
      }, 3000); 
      
      return () => clearInterval(simInterval);
    }

    return () => { 
      supabase.removeChannel(subDev); 
      supabase.removeChannel(subHist); 
    };
  }, [user]);

  // Anti-Islanding Watcher
  useEffect(() => {
    if (!liveData.grid.active && liveData.relays.r2) {
      const deviceId = user.dataType === 'real' ? user.espId : `sim_${user.uid}`;
      supabase.from('devices').upsert({ id: deviceId, relay_r2: false }).then();
      setLiveData(prev => ({ ...prev, relays: { ...prev.relays, r2: false } }));
    }
  }, [liveData.grid.active, liveData.relays.r2]);

  const displayHistory = (() => {
    let cutoff = Date.now(); 
    let bucketSizeMs = 3000; 
    
    if (filter === '1h') { cutoff -= 3600000; bucketSizeMs = 3000; } 
    else if (filter === '6h') { cutoff -= 6 * 3600000; bucketSizeMs = 60000; } 
    else if (filter === '12h') { cutoff -= 12 * 3600000; bucketSizeMs = 300000; } 
    else if (filter === '1d') { cutoff -= 24 * 3600000; bucketSizeMs = 600000; } 
    
    const buckets = {};
    history.filter(h => h.id >= cutoff).forEach(h => { 
      const b = Math.floor(h.id / bucketSizeMs) * bucketSizeMs; 
      if (!buckets[b]) buckets[b] = { count: 0, solarV: 0, solarI: 0, solarP: 0, batteryPct: 0, loadP: 0, exportCount: 0 }; 
      buckets[b].count++; 
      buckets[b].solarV += parseFloat(h.solarV); 
      buckets[b].solarI += parseFloat(h.solarI); 
      buckets[b].solarP += parseFloat(h.solarP); 
      buckets[b].batteryPct += h.batteryPct; 
      buckets[b].loadP += parseFloat(h.loadP); 
      if (h.gridStatus === 'Exporting') buckets[b].exportCount++; 
    });

    return Object.keys(buckets).map(t => { 
      const b = buckets[t], c = b.count, d = new Date(parseInt(t)); 
      const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const tStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      return { 
        id: parseInt(t), 
        timestamp: `${dStr}, ${tStr}`, 
        solarV: (b.solarV / c).toFixed(1), 
        solarI: (b.solarI / c).toFixed(1), 
        solarP: (b.solarP / c).toFixed(1), 
        batteryPct: Math.round(b.batteryPct / c), 
        loadP: (b.loadP / c).toFixed(1), 
        gridStatus: (b.exportCount / c) > 0.5 ? 'Exporting' : 'Importing' 
      }; 
    }).sort((a,b) => b.id - a.id);
  })();

  const netTotal = (liveData.billing.imported * TARIFF.BUY) - (liveData.billing.exported * TARIFF.SELL);

  const filterOptions = [
    { id: '1h', label: '1H (Raw)' },
    { id: '6h', label: '6H (1m Avg)' },
    { id: '12h', label: '12H (5m Avg)' },
    { id: '1d', label: '24H (10m Avg)' }
  ];

  return (
    <View style={styles.dashContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.kicker}>LIVE FEED ACTIVE</Text>
          <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <LogOut color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContainer}>
          {['Overview', 'Hardware', 'History', 'Billing', 'Support'].map(tab => (
            <TouchableOpacity 
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'Overview' && (
          <View style={styles.tabContent}>
            
            {/* Anti-Islanding Banner */}
            {!liveData.grid.active && (
              <View style={styles.islandingBanner}>
                <AlertTriangle color="#ef4444" size={24} />
                <Text style={styles.islandingText}>
                  ANTI-ISLANDING ENGAGED: Grid voltage critical ({liveData.grid.voltage.toFixed(1)}V). Power export is isolated.
                </Text>
              </View>
            )}

            <View style={styles.statusCard}>
              <View>
                <Text style={styles.statusLabel}>SYSTEM STATE</Text>
                <View style={styles.connectedRow}>
                  <CheckCircle2 color="#10b981" size={16} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
              </View>
              <View style={styles.alignRight}>
                <Text style={styles.statusLabel}>TARGET ESP</Text>
                <Text style={styles.espText}>{user.espId || 'SIM'}</Text>
              </View>
            </View>

            <View style={styles.grid}>
              <KpiCard label="PV Output" value={liveData.solar.power.toFixed(1)} unit="W" sub={`${liveData.solar.voltage.toFixed(1)}V / ${liveData.solar.current.toFixed(1)}A`} color="#10b981" icon={<Sun color="#10b981" size={20} />} />
              <KpiCard label="Battery" value={liveData.battery.percentage} unit="%" sub={`${liveData.battery.voltage.toFixed(1)}V • ${liveData.battery.temp.toFixed(1)}°C`} color="#3b82f6" icon={<Battery color="#3b82f6" size={20} />} />
              <KpiCard label="Load" value={liveData.load.power.toFixed(1)} unit="W" sub="Active" color="#6366f1" icon={<Activity color="#6366f1" size={20} />} />
              <KpiCard 
                label="Grid Status" 
                value={liveData.grid.active ? "Active" : "Down"} 
                unit="" 
                sub={liveData.grid.active ? (liveData.grid.importExport < 0 ? "Exporting" : "Importing") : "Isolated"} 
                color={liveData.grid.active ? (liveData.grid.importExport < 0 ? "#10b981" : "#3b82f6") : "#ef4444"} 
                icon={<ArrowRightLeft color={liveData.grid.active ? (liveData.grid.importExport < 0 ? "#10b981" : "#3b82f6") : "#ef4444"} size={20} />} 
              />
            </View>
          </View>
        )}

        {activeTab === 'Hardware' && (
          <View style={styles.tabContent}>
            <View style={styles.warningCard}>
              <ShieldAlert color="#f97316" size={24} />
              <Text style={styles.warningText}>
                Hardware control is strictly restricted to the Desktop Admin Dashboard to prevent accidental edge actuation.
              </Text>
            </View>
            
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Relay Status</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyText}>ADMIN LOCKED</Text>
                </View>
              </View>
              
              {/* R1 (Load Source) */}
              <View style={[styles.relayRow, styles.borderBottom]}>
                <Text style={styles.relayName}>R1 (Load Source)</Text>
                <View style={[styles.relayBadge, liveData.relays.r1 ? styles.r1Active : styles.r1Inactive]}>
                  <Text style={[styles.relayBadgeText, liveData.relays.r1 ? styles.r1ActiveText : styles.r1InactiveText]}>
                    {liveData.relays.r1 ? 'NO (Battery)' : 'NC (Grid)'}
                  </Text>
                </View>
              </View>

              {/* R2 (PV Route) */}
              <View style={styles.relayRow}>
                <View style={styles.r2LabelGroup}>
                  <Text style={styles.relayName}>R2 (PV Route)</Text>
                  {!liveData.grid.active && <AlertTriangle color="#ef4444" size={14} style={{marginLeft: 6}} />}
                </View>
                <View style={[styles.relayBadge, liveData.relays.r2 ? styles.r2Active : styles.r2Inactive]}>
                  <Text style={[styles.relayBadgeText, liveData.relays.r2 ? styles.r2ActiveText : styles.r2InactiveText]}>
                    {liveData.relays.r2 ? 'NO (Grid)' : 'NC (Battery)'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'History' && (
          <View style={styles.card}>
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleRow}>
                <List color="#10b981" size={20} />
                <Text style={styles.historyTitle}>Data Logs</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipContainer}>
              {filterOptions.map(opt => (
                <TouchableOpacity 
                  key={opt.id} 
                  onPress={() => setFilter(opt.id)}
                  style={[styles.filterChip, filter === opt.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, filter === opt.id && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.historyList}>
              {displayHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No history available for this range.</Text>
                </View>
              ) : (
                displayHistory.slice(0, 100).map(row => (
                  <View key={row.id} style={styles.historyRow}>
                    <View style={styles.historyRowTop}>
                      <Text style={styles.historyTime}>{row.timestamp}</Text>
                      <View style={[styles.statusBadge, row.gridStatus === 'Exporting' ? styles.badgeExport : styles.badgeImport]}>
                        <Text style={[styles.statusBadgeText, row.gridStatus === 'Exporting' ? styles.textExport : styles.textImport]}>
                          {row.gridStatus}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.historyRowBottom}>
                      <View style={styles.historyColLeft}>
                        <Text style={styles.historyColLabel}>SOLAR (PV)</Text>
                        <Text style={styles.historyColValue}>{row.solarV}V • {row.solarP}W</Text>
                      </View>
                      <View style={styles.historyColRight}>
                        <Text style={styles.historyColLabel}>BATTERY SOC</Text>
                        <View style={styles.batteryVisualRow}>
                          <View style={styles.batteryBarTrack}>
                            <View style={[styles.batteryBarFill, { width: `${row.batteryPct}%`, backgroundColor: row.batteryPct > 50 ? '#10b981' : '#f59e0b' }]} />
                          </View>
                          <Text style={styles.historyColValue}>{row.batteryPct}%</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {activeTab === 'Billing' && (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <DollarSign color="#34d399" size={24} />
            </View>
            <Text style={styles.billTitle}>Real-Time Statement</Text>
            <Text style={styles.billDesc}>Based on accumulated kWh logic.</Text>
            
            <BillRow label={`Imported (${liveData.billing.imported.toFixed(4)} kWh)`} value={`₹${(liveData.billing.imported * TARIFF.BUY).toFixed(2)}`} type="red" />
            <BillRow label={`Exported (${liveData.billing.exported.toFixed(4)} kWh)`} value={`- ₹${(liveData.billing.exported * TARIFF.SELL).toFixed(2)}`} type="green" />
            <BillRow label="Fixed Metering Charge" value="₹150.00" type="slate" />
            
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>NET PAYABLE</Text>
              <Text style={[styles.netValue, { color: netTotal + 150 > 0 ? '#f97316' : '#10b981' }]}>
                ₹{Math.abs(netTotal + 150).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'Support' && (
          <View style={styles.tabContent}>
            
            {/* System Admin Card */}
            <View style={styles.card}>
              <View style={styles.supportHeader}>
                <View style={[styles.supportIconWrapper, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                  <Shield color="#818cf8" size={24} />
                </View>
                <View>
                  <Text style={styles.supportTitle}>System Administrator</Text>
                  <Text style={styles.supportSub}>Primary Grid Manager</Text>
                </View>
              </View>
              <View style={styles.supportContent}>
                <SupportRow icon={<User color="#cbd5e1" size={16} />} text={adminInfo.name} />
                <SupportRow icon={<Phone color="#cbd5e1" size={16} />} text={adminInfo.mobile || 'N/A'} />
                <SupportRow icon={<Mail color="#cbd5e1" size={16} />} text={adminInfo.email} />
              </View>
            </View>

            {/* Tech Support Card */}
            <View style={[styles.card, { backgroundColor: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }]}>
              <View style={[styles.supportHeader, { borderBottomColor: 'rgba(16,185,129,0.2)' }]}>
                <View style={[styles.supportIconWrapper, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <LifeBuoy color="#34d399" size={24} />
                </View>
                <View>
                  <Text style={[styles.supportTitle, { color: '#34d399' }]}>Technical Support</Text>
                  <Text style={[styles.supportSub, { color: 'rgba(5,150,105,0.7)' }]}>Emergency & Maintenance</Text>
                </View>
              </View>
              <View style={styles.supportContent}>
                <SupportRow icon={<User color="#34d399" size={16} />} text="Arya B V" isGreen />
                <SupportRow icon={<Zap color="#fbbf24" size={16} />} text="BESCOM Grid Operations" isGreen />
                <SupportRow icon={<Phone color="#34d399" size={16} />} text="8050141198" isGreen isBold />
              </View>
            </View>

          </View>
        )}
      </ScrollView>
    </View>
  );
};

// --- REUSABLE COMPONENTS ---
const KpiCard = ({ label, value, unit, sub, color, icon }) => (
  <View style={styles.kpiCard}>
    <View style={[styles.kpiIconWrapper, { backgroundColor: `${color}20` }]}>
      {icon}
    </View>
    <View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>
        {value} <Text style={styles.kpiUnit}>{unit}</Text>
      </Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  </View>
);

const BillRow = ({ label, value, type }) => (
  <View style={styles.billRow}>
    <Text style={styles.billLabel}>{label}</Text>
    <Text style={[
      styles.billValue, 
      type === 'red' && { color: '#f97316' },
      type === 'green' && { color: '#10b981' },
      type === 'slate' && { color: '#cbd5e1' }
    ]}>
      {value}
    </Text>
  </View>
);

const SupportRow = ({ icon, text, isGreen, isBold }) => (
  <View style={styles.supportRow}>
    <View style={[styles.supportRowIcon, isGreen && { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
      {icon}
    </View>
    <Text style={[styles.supportRowText, isBold && { fontWeight: '900', color: '#34d399' }]}>
      {text}
    </Text>
  </View>
);

// --- STYLESHEET ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#09090E' },
  loadingContainer: { flex: 1, backgroundColor: '#09090E', justifyContent: 'center', alignItems: 'center' },
  
  // Login Styles
  loginContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#09090E' },
  iconWrapper: { width: 80, height: 80, backgroundColor: 'white', borderRadius: 24, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: 'white', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#94a3b8', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 48 },
  formContainer: { width: '100%' },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#64748b', marginBottom: 8, letterSpacing: 1, marginLeft: 4 },
  input: { backgroundColor: '#1A1A24', color: 'white', borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 'bold', borderWidth: 1, borderColor: '#2A2A35', marginBottom: 16 },
  button: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: 'white', fontWeight: '900', fontSize: 15 },

  // Dashboard Styles
  dashContainer: { flex: 1, backgroundColor: '#09090E' },
  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTextWrapper: { flex: 1, paddingRight: 16 },
  kicker: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  userName: { color: 'white', fontSize: 24, fontWeight: '900' },
  logoutBtn: { backgroundColor: '#1A1A24', padding: 12, borderRadius: 30, borderWidth: 1, borderColor: '#2A2A35' },
  
  // Tabs
  tabWrapper: { paddingHorizontal: 24, marginBottom: 24 },
  tabScrollContainer: { backgroundColor: '#1A1A24', borderRadius: 30, padding: 6, borderWidth: 1, borderColor: '#2A2A35', flexDirection: 'row' },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 30, alignItems: 'center', minWidth: 80 },
  tabBtnActive: { backgroundColor: 'white' },
  tabText: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8' },
  tabTextActive: { color: '#0f172a' },
  
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  tabContent: { gap: 16 },

  // Cards
  statusCard: { backgroundColor: 'rgba(26,26,36,0.9)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#2A2A35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectedText: { color: '#34d399', fontWeight: 'bold', fontSize: 14 },
  alignRight: { alignItems: 'flex-end' },
  espText: { color: 'white', fontWeight: 'bold', fontSize: 14, fontFamily: 'System' },
  
  islandingBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)', borderWidth: 1, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  islandingText: { color: '#f87171', fontSize: 11, fontWeight: 'bold', flex: 1, lineHeight: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiCard: { width: '48%', backgroundColor: 'rgba(26,26,36,0.9)', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#2A2A35', marginBottom: 16 },
  kpiIconWrapper: { padding: 8, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 16 },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 24, fontWeight: '900', color: 'white', marginBottom: 2 },
  kpiUnit: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  kpiSub: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  // Hardware Tab
  warningCard: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.2)', borderWidth: 1, padding: 16, borderRadius: 20, flexDirection: 'row', gap: 12, marginBottom: 16 },
  warningText: { color: '#fb923c', fontSize: 12, fontWeight: 'bold', flex: 1, lineHeight: 18 },
  card: { backgroundColor: 'rgba(26,26,36,0.9)', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#2A2A35' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: 'white' },
  readOnlyBadge: { backgroundColor: '#2A2A35', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  readOnlyText: { fontSize: 9, fontWeight: 'bold', color: '#cbd5e1', letterSpacing: 1 },
  
  // Hardware Relays
  relayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#2A2A35' },
  r2LabelGroup: { flexDirection: 'row', alignItems: 'center' },
  relayName: { fontSize: 13, fontWeight: 'bold', color: '#cbd5e1' },
  relayBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  relayBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  r1Active: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' },
  r1ActiveText: { color: '#34d399' },
  r1Inactive: { backgroundColor: '#2A2A35', borderColor: '#3A3A45' },
  r1InactiveText: { color: '#94a3b8' },
  
  r2Active: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' },
  r2ActiveText: { color: '#fbbf24' },
  r2Inactive: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' },
  r2InactiveText: { color: '#34d399' },

  // History Tab
  historyHeader: { marginBottom: 16 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { color: 'white', fontWeight: '900', fontSize: 18 },
  
  filterChipContainer: { paddingBottom: 16, gap: 8 },
  filterChip: { backgroundColor: '#2A2A35', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#3A3A45' },
  filterChipActive: { backgroundColor: 'white', borderColor: 'white' },
  filterChipText: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
  filterChipTextActive: { color: '#09090E' },
  
  historyList: { gap: 12 },
  emptyState: { paddingVertical: 40, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#2A2A35', borderRadius: 16 },
  emptyStateText: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
  
  historyRow: { backgroundColor: 'rgba(9,9,14,0.6)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#2A2A35' },
  historyRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2A2A35', paddingBottom: 10, marginBottom: 10 },
  historyTime: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeExport: { backgroundColor: 'rgba(16,185,129,0.1)' },
  badgeImport: { backgroundColor: 'rgba(249,115,22,0.1)' },
  statusBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  textExport: { color: '#34d399' },
  textImport: { color: '#fb923c' },
  
  historyRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyColLeft: { flex: 1 },
  historyColRight: { flex: 1, alignItems: 'flex-end' },
  historyColLabel: { fontSize: 9, color: '#64748b', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  historyColValue: { fontSize: 14, color: 'white', fontWeight: '900' },
  batteryVisualRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryBarTrack: { width: 40, height: 6, backgroundColor: '#2A2A35', borderRadius: 3, overflow: 'hidden' },
  batteryBarFill: { height: '100%' },

  // Billing Tab
  iconCircle: { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  billTitle: { fontSize: 18, fontWeight: '900', color: 'white', marginBottom: 4 },
  billDesc: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 24 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A2A35' },
  billLabel: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8' },
  billValue: { fontSize: 15, fontWeight: '900' },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 16, borderTopWidth: 1, borderTopColor: '#2A2A35' },
  netLabel: { color: '#cbd5e1', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  netValue: { fontSize: 28, fontWeight: '900' },

  // Support Tab
  supportHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#2A2A35' },
  supportIconWrapper: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  supportTitle: { fontSize: 18, fontWeight: '900', color: 'white' },
  supportSub: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  supportContent: { gap: 16 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportRowIcon: { width: 32, height: 32, backgroundColor: '#2A2A35', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  supportRowText: { fontSize: 14, fontWeight: 'bold', color: '#e2e8f0' }
});
