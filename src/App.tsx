import { useMemo, useState, useEffect, Suspense, lazy } from "react";
import Header from "./components/Header";
import Input from "./components/Input";
import RincianHarian from "./components/RincianHarian";
import RincianJajanan from "./components/RincianJajanan";
import RincianJasaAksesoris from "./components/RincianJasaAksesoris";
import RincianSewa from "./components/RincianSewa";
import RekapPemasukan from "./components/RekapPemasukan";
import RincianSetoran from "./components/RincianSetoran";
import RincianPengeluaran from "./components/RincianPengeluaran";
import FilterComp from "./components/Filter";
import HistoryPembukuan from "./components/HistoryPembukuan";
import Footer from "./components/Footer";
import GeminiReportGenerator from "./components/GeminiReportGenerator";
import Reminder from "./components/Reminder";
import PdfExporter from "./components/PdfExporter";
import { sewaItemHint } from "./lib/priceLists";
const Pengaturan = lazy(() => import("./components/Pengaturan"));
const EditRincian = lazy(() => import("./components/EditRincian"));
const HalamanStok = lazy(() => import("./components/HalamanStok"));
const PageOwner = lazy(() => import("./components/PageOwner"));
const POSModal = lazy(() => import("./components/POSModal"));
const GalleryModal = lazy(() => import("./components/GalleryModal"));
const HalamanMonitoring = lazy(() => import("./components/HalamanMonitoring"));
import HalamanLainnyaDaftar, { JUDUL_LAINNYA, KembaliLainnya, MENU_LAINNYA } from "./components/HalamanLainnya";
import useRequestEditPending from "./hooks/useRequestEditPending";
import type { HalamanLainnya, TabUtama } from "./lib/navigasi";
import LiveCursors from "./components/LiveCursors";
import Login from "./components/Login";
import versionData from "./version.json";
import ChallengeButton from "./games/components/ChallengeButton";
import AdminNotes from "./components/AdminNotes";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  Ellipsis,
  Info,
  Package,
  Save,
  User,
} from "lucide-react";
import { GAME_NAMES_ID } from "./games/constants";
import useAppController from "./hooks/useAppController";
import { AlertDialog, AppShell, Button, IconBadge, type NavItem, type NavSection, warnaPengguna } from "./ui";
import { petaWaPenyewa } from "./lib/pengingatSewa";
import PeringatanSewaHabis from "./components/PeringatanSewaHabis";
import { totalPemasukanHarian } from "./lib/keuangan";
import { JAM_GANTI_HARI, toLocalYmd } from "./lib/dateLocal";
import { rupiah } from "./lib/format";

const ChallengeModal = lazy(() => import("./games/components/ChallengeModal"));

export default function App() {
  const {
    rootRef,
    appStokData,
    pdfRef,
    dark,
    themeMode,
    showChallenge,
    setShowChallenge,
    gameConfig,
    kualitasGambar,
    tableMode,
    setIsExportingPDF,
    isMobileTable,
    user,
    authLoading,
    isSuperAdminOrOwner,
    userProfilePic,
    userProfileColor,
    customBgDark,
    handleProfilePicChange,
    handleBgDarkChange,
    triggeredAssistants,
    handleRunAssistant,
    handleDismissAssistant,
    tanggal,
    setTanggal,
    hari,
    setHari,
    activeTab,
    setActiveTab,
    adminMonitoringTab,
    setAdminMonitoringTab,
    handleOpenScan,
    activeUsers,
    absenPagi,
    setAbsenPagi,
    absenSiang,
    setAbsenSiang,
    shiftPegawai,
    setShiftPegawai,
    openSettings,
    setOpenSettings,
    openPOS,
    setOpenPOS,
    openGallery,
    setOpenGallery,
    userProfileLoaded,
    isDeactivated,
    editingId,
    rukoBuka,
    setRukoBuka,
    rukoBukaDate,
    rukoTutup,
    setRukoTutup,
    rukoTutupDate,
    catatan,
    setCatatan,
    showDuplicateDateAlert,
    setShowDuplicateDateAlert,
    showUnsavedAlert,
    setShowUnsavedAlert,
    validationAlert,
    setValidationAlert,
    showSuccessAlert,
    setShowSuccessAlert,
    successMessage,
    showStokConfirmation,
    setShowStokConfirmation,
    showRecheckAlert,
    setShowRecheckAlert,
    triggerValidationError,
    savedSignature,
    hargaHarian,
    hargaJajanan,
    hargaJasaAks,
    hargaSewa,
    ongkirConfig,
    absenConfig,
    openEditRincian,
    setOpenEditRincian,
    rincianVisibility,
    handleUpdateRincianVisibility,
    getPrices,
    getTitle,
    handleSavePrices,
    handleResetSpecificDefault,
    rowsHarian,
    setRowsHarian,
    rowsJajanan,
    setRowsJajanan,
    rowsJasaAks,
    setRowsJasaAks,
    barisNotaJasa,
    notaBarangHari,
    salesNotaHari,
    rowsSewa,
    setRowsSewa,
    rowsSetoran,
    setRowsSetoran,
    rowsPengeluaran,
    setRowsPengeluaran,
    totalHarian,
    totalJajanan,
    totalJasaAks,
    totalSewa,
    totalCash,
    totalTransfer,
    totalPengeluaran,
    hasData,
    mandatoryFilled,
    history,
    filter,
    setFilter,
    filterMonth,
    setFilterMonth,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    filteredHistory,
    exportData,
    currentFormSignature,
    unverifiedRentals,
    paymentVerifyPrompt,
    handleVerifyReturn,
    handleCatatPengingat,
    validateTransactions,
    handleShareCheck,
    addPencatatan,
    updatePencatatan,
    editHistoryItem,
    deleteHistoryItem,
    restoreInputRef,
    doBackup,
    onPickRestoreFile,
    handleBackupDrive,
    handleRestoreDrive,
    exportCSV,
    resetSetting,
    blankHarian,
    blankJajanan,
    blankJasaAks,
    newBlankSewa,
    catalogChanges,
    hasPOSUpdate,
    handleResetRukoBuka,
    handleResetRukoTutup,
    handleResetAbsenPagi,
    handleResetAbsenSiang,
    handleResetForm,
    handleUpdateOngkirConfig,
    handleUpdateAbsenConfig,
    handleUpdateThemeMode,
    handleUpdateTableMode,
    handleUpdateKualitasGambar,
    handleLogout,
    handleUpdateProfileColor,
    handlePaymentVerifyNo,
    handlePaymentVerifyYes
  } = useAppController();
  const [posMounted, setPosMounted] = useState(false);
  useEffect(() => {
    if (openPOS) setPosMounted(true);
  }, [openPOS]);
  const tabFallback = (
    <div className="py-16 flex items-center justify-center">
      <div className="w-8 h-8 border-[3px] border-tint border-t-transparent rounded-full animate-spin" />
    </div>
  );
  // Saran isi cepat No. WA penyewa dari riwayat sewa (nama penyewa -> WA terakhir)
  const waPenyewaTerakhir = useMemo(() => petaWaPenyewa(history), [history]);

  // ===== NAVIGASI SATU LAPIS (lihat src/lib/navigasi.ts) =====
  const [halLainnya, setHalLainnya] = useState<HalamanLainnya | null>(null);
  const requestPending = useRequestEditPending(isSuperAdminOrOwner);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { key: "MONITORING", label: "Monitoring", icon: <Activity />, color: "teal" },
      { key: "USAHA RENTAL", label: "Pembukuan", icon: <BookOpen />, color: "blue" },
      { key: "UPDATE STOK", label: "Stok", icon: <Package />, color: "orange" },
    ];
    if (isSuperAdminOrOwner) {
      items.push({ key: "ANALITIK", label: "Analitik", icon: <BarChart3 />, color: "indigo" });
      items.push({ key: "LAINNYA", label: "Lainnya", icon: <Ellipsis />, color: "gray", dot: requestPending > 0 });
    }
    return items;
  }, [isSuperAdminOrOwner, requestPending]);

  // Laptop: isi menu Lainnya tampil langsung di sidebar (tanpa halaman daftar)
  const sidebarSections = useMemo<NavSection[]>(() => {
    if (!isSuperAdminOrOwner) return [{ title: "Menu utama", items: navItems }];
    return [
      { title: "Menu utama", items: navItems.filter((n) => n.key !== "LAINNYA") },
      {
        title: "Lainnya",
        items: MENU_LAINNYA.map((m) => ({
          key: `LAINNYA:${m.key}`,
          label: m.judul,
          icon: m.icon,
          color: m.warna,
          badge: m.key === "REQUEST" && requestPending > 0 ? requestPending : undefined,
        })),
      },
    ];
  }, [isSuperAdminOrOwner, navItems, requestPending]);

  const pilihTab = (k: string) => {
    if (k.startsWith("LAINNYA:")) {
      setHalLainnya(k.slice(8) as HalamanLainnya);
      setActiveTab("LAINNYA");
      return;
    }
    // Ketuk tab Lainnya yang sedang aktif = kembali ke daftar (seperti iOS)
    if (k === "LAINNYA" && activeTab === "LAINNYA") setHalLainnya(null);
    setActiveTab(k as TabUtama);
  };

  const subLainnya = isSuperAdminOrOwner && activeTab === "LAINNYA" ? halLainnya : null;
  const sidebarKey = subLainnya ? `LAINNYA:${subLainnya}` : activeTab;
  const activeNavLabel = subLainnya ? JUDUL_LAINNYA[subLainnya] : navItems.find((n) => n.key === activeTab)?.label ?? "Pembukuan Digital";

  if (authLoading || (user && !userProfileLoaded && !isDeactivated)) {
    return (
      <div className="min-h-screen flex items-center justify-center apple-canvas">
        <div className="w-10 h-10 border-4 border-tint border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || isDeactivated) {
    return <Login deactivatedError={isDeactivated ? "Email atau Password salah." : ""} />;
  }

  const namaPendek = user?.email?.split("@")[0] || "User";

  return (
    <>
      <PdfExporter
        ref={pdfRef}
        rootRef={rootRef}
        dark={dark}
        kualitasGambar={kualitasGambar}
        data={exportData}
        stokData={appStokData.stokState}
        masterCategories={appStokData.masterCategories}
        onStartExport={() => setIsExportingPDF(true)}
        onEndExport={() => setIsExportingPDF(false)}
      />

      <div ref={rootRef} className={`relative min-h-screen text-label ${dark ? "bg-black" : "apple-canvas"}`}>
        {/* Background dark mode: tampil apa adanya tanpa frosted, hanya UI card yang frosted */}
        {dark && (
          <>
            <div
              className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url("${customBgDark || `${import.meta.env.BASE_URL}images/bg_dark.jpg`}")`,
              }}
              aria-hidden="true"
            />
            <div className="fixed inset-0 bg-black/60 pointer-events-none z-0" aria-hidden="true" />
          </>
        )}

        <div className="relative z-10">
          <AppShell
            activeKey={sidebarKey}
            mobileActiveKey={activeTab}
            onSelectKey={pilihTab}
            sidebarSections={sidebarSections}
            mobileTabs={navItems}
            sidebarHeader={
              <div className="flex items-center gap-3 p-2.5 rounded-tile bg-fill/60 border border-sep">
                <div className="w-10 h-10 rounded-full bg-surface-elevated ring-1 ring-edge overflow-hidden flex items-center justify-center shrink-0">
                  {userProfilePic ? (
                    <img src={userProfilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-label-2" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-subhead font-semibold text-label truncate">Hi, {namaPendek}</div>
                  <div className="text-caption2 text-label-2 truncate">URBAN Gaming · Pembukuan</div>
                </div>
              </div>
            }
            sidebarFooter={
              <div className="space-y-2.5">
                {activeUsers && activeUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-caption2 font-semibold uppercase tracking-wider text-label-3 px-0.5">
                      User Aktif (Live)
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeUsers.map((u) => {
                        return (
                          <span
                            key={u.uid}
                            style={{ backgroundColor: u.profileColor || warnaPengguna(u.email) }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption2 font-semibold text-white uppercase tracking-wide"
                            title={`Sedang aktif di tab: ${u.tab}`}
                          >
                            <span className="max-w-[110px] truncate">
                              {u.email === user?.email ? "Saya" : u.email.split("@")[0]}
                            </span>
                            {u.tab === "UPDATE STOK" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-caption2 font-mono text-label-3 px-0.5">
                  <span>URBAN PS</span>
                  <span>V{versionData.version}</span>
                </div>
              </div>
            }
            topBar={
              <Header
                rootRef={rootRef}
                tanggal={tanggal}
                sectionTitle={activeNavLabel}
                onSharePDF={handleShareCheck}
                onOpenSettings={() => setOpenSettings(true)}
                onOpenScan={handleOpenScan}
                onOpenPOS={() => setOpenPOS(true)}
                onOpenGallery={() => setOpenGallery(true)}
                isSuperAdminOrOwner={isSuperAdminOrOwner}
                hasData={hasData}
                mandatoryFilled={mandatoryFilled}
                isEditing={!!editingId}
                hasUnsavedChanges={currentFormSignature !== savedSignature}
                onSaveEdit={updatePencatatan}
                onAddData={addPencatatan}
                onCancelEdit={() => window.location.reload()}
                userEmail={user?.email}
                userProfilePic={userProfilePic || undefined}
                activeUsers={activeUsers}
                hasPOSUpdate={hasPOSUpdate}
              />
            }
            floatingTopBar
          >

            {activeTab === "MONITORING" ? (
              <Suspense fallback={tabFallback}>
                <HalamanMonitoring
                  isOwner={isSuperAdminOrOwner}
                  segmen={adminMonitoringTab}
                  onSegmen={setAdminMonitoringTab}
                  history={history || []}
                  rowsSewa={rowsSewa}
                  activeDate={tanggal}
                  onVerifyActiveRental={handleVerifyReturn}
                  onPengingat={handleCatatPengingat}
                  hargaItems={hargaSewa}
                  isVerifyingPayment={!!paymentVerifyPrompt}
                />
              </Suspense>
            ) : activeTab === "UPDATE STOK" ? (
              <Suspense fallback={tabFallback}>
                <HalamanStok isOwner={isSuperAdminOrOwner} tampilJajanan={rincianVisibility.jajanan !== false} />
              </Suspense>
            ) : isSuperAdminOrOwner && activeTab === "LAINNYA" && !subLainnya ? (
              <HalamanLainnyaDaftar pending={requestPending} onBuka={setHalLainnya} onPengaturan={() => setOpenSettings(true)} />
            ) : isSuperAdminOrOwner && (activeTab === "ANALITIK" || activeTab === "LAINNYA") ? (
              <div className="space-y-3">
                {subLainnya && <KembaliLainnya onKembali={() => setHalLainnya(null)} />}
                <Suspense fallback={tabFallback}>
                  <PageOwner
                    bagian={subLainnya ?? "ANALITIK"}
                    totalHarian={totalHarian} totalJajanan={totalJajanan}
                    totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                    totalCash={totalCash}
                    totalTransfer={totalTransfer}
                    totalPengeluaran={totalPengeluaran}
                    pendapatanBersih={totalPemasukanHarian({ totalHarian, totalJajanan, totalJasaAks, totalSewa }) - totalPengeluaran}
                    history={history}
                    rowsSewa={rowsSewa}
                    filterMode={filter}
                    setFilterMode={setFilter}
                    filterMonth={filterMonth}
                    setFilterMonth={setFilterMonth}
                    rangeStart={rangeStart}
                    setRangeStart={setRangeStart}
                    rangeEnd={rangeEnd}
                    setRangeEnd={setRangeEnd}
                    filteredHistory={filteredHistory}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
                <div id="section-input">
              <Input
                tanggal={tanggal} setTanggal={setTanggal} hari={hari} setHari={setHari}
                shiftPegawai={shiftPegawai} setShiftPegawai={setShiftPegawai}
                absenPagi={absenPagi} setAbsenPagi={setAbsenPagi} absenSiang={absenSiang} setAbsenSiang={setAbsenSiang}
                rukoBuka={rukoBuka} rukoTutup={rukoTutup}
                catatan={catatan} setCatatan={setCatatan}
                onCatatanFocus={(e) => {
                  const valStatus = validateTransactions();
                  if (valStatus !== "ok") {
                    e.currentTarget.blur();
                    triggerValidationError(valStatus);
                  }
                }}
                absenConfig={absenConfig}
                isOwner={isSuperAdminOrOwner}
                setRukoBuka={(v, d) => setRukoBuka(v, d)}
                rukoBukaDate={rukoBukaDate}
                setRukoTutup={(v, d) => setRukoTutup(v, d)}
                rukoTutupDate={rukoTutupDate}
                onResetRukoBuka={handleResetRukoBuka}
                onResetRukoTutup={handleResetRukoTutup}
                onResetAbsenPagi={handleResetAbsenPagi}
                onResetAbsenSiang={handleResetAbsenSiang}
                onReset={handleResetForm}
                isAbsenBlocked={(() => {
                  const wib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
                  const h = wib.getHours();
                  const m = wib.getMinutes();
                  const totalMin = h * 60 + m;
                  // Dini hari (masih hari kerja kemarin, toleransi checkout shift malam): tidak diblok
                  if (totalMin < JAM_GANTI_HARI * 60) return false;
                  // Mulai jam 09:45 pagi ke atas (toko buka hari baru): tidak diblok
                  if (totalMin >= 585) return false;
                  // Antara pergantian hari kerja s.d 09:45 pagi: blok jika data kemarin sudah disimpan
                  const yesterday = new Date(wib);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yStr = toLocalYmd(yesterday);
                  return history.some(h2 => h2.tanggal === yStr);
                })()}
              />
            </div>
            
            <div id="section-rincian" className="space-y-5 sm:space-y-6">
              <ChallengeButton
                isAbsenDone={absenPagi !== "" || isSuperAdminOrOwner}
                activeGameName={gameConfig ? (GAME_NAMES_ID[gameConfig.activeGame] || gameConfig.activeGame) : ""}
                onClick={() => setShowChallenge(true)}
              />
              <AdminNotes
                isOwner={isSuperAdminOrOwner}
                currentUserEmail={user?.email}
                adminName={user?.email ? user.email.split("@")[0] : "Admin"}
              />
              {rincianVisibility.harian !== false && <RincianHarian rows={rowsHarian} setRows={setRowsHarian} blank={{ ...blankHarian }} hargaItems={hargaHarian} isMobileTable={isMobileTable} />}
              {rincianVisibility.jajanan !== false && <RincianJajanan rows={rowsJajanan} setRows={setRowsJajanan} blank={{ ...blankJajanan }} hargaItems={hargaJajanan} isMobileTable={isMobileTable} />}
              {rincianVisibility.jasaAks !== false && <RincianJasaAksesoris rows={rowsJasaAks} setRows={setRowsJasaAks} blank={{ ...blankJasaAks }} hargaItems={hargaJasaAks} isMobileTable={isMobileTable} barisNota={barisNotaJasa} notaBarang={notaBarangHari} salesNota={salesNotaHari} />}
              {rincianVisibility.sewa !== false && <RincianSewa rows={rowsSewa} setRows={setRowsSewa} blank={newBlankSewa()} hargaItems={hargaSewa} userEmail={user?.email} isMobileTable={isMobileTable} tanggal={tanggal} waTerakhir={waPenyewaTerakhir} />}
            </div>
            <div className="space-y-5 sm:space-y-6">
              {rincianVisibility.pengeluaran !== false && <div id="section-pengeluaran">
                 <RincianPengeluaran 
                    rows={rowsPengeluaran} setRows={setRowsPengeluaran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                    userEmail={user?.email}
                    isOwner={isSuperAdminOrOwner}
                 />
              </div>}
              {rincianVisibility.setoran !== false && <div id="section-setoran">
                 <RincianSetoran 
                    rows={rowsSetoran} setRows={setRowsSetoran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                    ongkirMasukGaji={Boolean(ongkirConfig?.masukGaji)}
                    totalCash={totalCash}
                    rowsPengeluaran={rowsPengeluaran}
                 />
              </div>}
            </div>
            
            <div id="section-rekap">
              <RekapPemasukan
                totalHarian={totalHarian} totalJajanan={totalJajanan}
                totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                totalCash={totalCash} 
                totalTransfer={totalTransfer}
                totalPengeluaran={totalPengeluaran}
                pendapatanBersih={totalPemasukanHarian({ totalHarian, totalJajanan, totalJasaAks, totalSewa }) - totalPengeluaran}
              />
            </div>
            
            {isSuperAdminOrOwner && (
              <FilterComp
                mode={filter} setMode={setFilter} month={filterMonth} setMonth={setFilterMonth}
                rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
              />
            )}
            
            <div id="section-history">
              <HistoryPembukuan
                items={filteredHistory}
                onEdit={editHistoryItem} onDelete={deleteHistoryItem}
                isOwner={isSuperAdminOrOwner}
              />
            </div>
            
            <GeminiReportGenerator history={history} currentDate={tanggal} currentData={exportData} />
            
            <Reminder />
              </div>
            )}
            <Footer />
          </AppShell>

          {!!openEditRincian && (
            <Suspense fallback={null}>
              <EditRincian
                isOpen={!!openEditRincian}
                title={getTitle(openEditRincian)}
                initialData={openEditRincian ? getPrices(openEditRincian) : []}
                onClose={() => setOpenEditRincian(null)}
                onSave={async (items, baseline) => { if (openEditRincian) await handleSavePrices(openEditRincian, items, baseline); }}
                onResetDefault={() => openEditRincian && handleResetSpecificDefault(openEditRincian)}
                getItemHint={openEditRincian === "sewa" ? sewaItemHint : undefined}
              />
            </Suspense>
          )}

          <input ref={restoreInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => onPickRestoreFile(e.target.files?.[0] ?? null)} />
          
          {openSettings && (
            <Suspense fallback={null}>
              <Pengaturan
                open={openSettings} onClose={() => setOpenSettings(false)}
                isOwner={isSuperAdminOrOwner}
                hargaHarian={hargaHarian} hargaJajanan={hargaJajanan} hargaJasaAks={hargaJasaAks} hargaSewa={hargaSewa}
                ongkirConfig={ongkirConfig} setOngkirConfig={handleUpdateOngkirConfig}
                absenConfig={absenConfig} setAbsenConfig={handleUpdateAbsenConfig}
                themeMode={themeMode} onThemeChange={handleUpdateThemeMode}
                tableMode={tableMode} onTableModeChange={handleUpdateTableMode}
                kualitasGambar={kualitasGambar} onKualitasGambarChange={handleUpdateKualitasGambar}
                onBackupData={doBackup} onRestoreData={() => restoreInputRef.current?.click()} 
                onBackupDrive={handleBackupDrive} onRestoreDrive={handleRestoreDrive}
                onExportCSV={exportCSV} onResetSetting={resetSetting}
                onLogout={handleLogout}
                onOpenEditHarian={() => setOpenEditRincian("harian")}
                onOpenEditJajanan={() => setOpenEditRincian("jajanan")}
                onOpenEditJasaAks={() => setOpenEditRincian("jasaAks")}
                onOpenEditSewa={() => setOpenEditRincian("sewa")}
                rincianVisibility={rincianVisibility}
                onRincianVisibilityChange={handleUpdateRincianVisibility}
                userEmail={user?.email}
                userProfilePic={userProfilePic || undefined}
                onProfilePicChange={handleProfilePicChange}
                customBgDark={customBgDark || undefined}
                onBgDarkChange={(url) => handleBgDarkChange(url)}
                userProfileColor={userProfileColor}
                onProfileColorChange={handleUpdateProfileColor}
                history={history}
              />
            </Suspense>
          )}

          {posMounted && (
            <Suspense fallback={null}>
              <POSModal
                open={openPOS}
                onClose={() => setOpenPOS(false)}
                isSuperAdminOrOwner={isSuperAdminOrOwner}
                adminName={user?.email ? user.email.split('@')[0] : "Admin"}
                catalogChanges={catalogChanges}
              />
            </Suspense>
          )}

          {openGallery && (
            <Suspense fallback={null}>
              <GalleryModal
                open={openGallery}
                onClose={() => setOpenGallery(false)}
                isSuperAdminOrOwner={isSuperAdminOrOwner}
                adminName={user?.email ? user.email.split('@')[0] : "Super Admin"}
              />
            </Suspense>
          )}

          {/* === POPUPS: UDS APPLE HIG === */}
          <AlertDialog
            open={triggeredAssistants.length > 0}
            onClose={() => {}}
            dismissible={false}
            zClassName="z-[501]"
            icon={<Bot />}
            iconColor="cyan"
            title="Rekomendasi Asisten"
            description={
              triggeredAssistants[0] ? (
                <div className="space-y-3">
                  <p>
                    Hari ini tanggal <strong className="font-semibold text-label">{triggeredAssistants[0].tanggal}</strong>, asisten mendeteksi jadwal pengeluaran rutin Anda:
                  </p>
                  <div className="w-full rounded-tile bg-fill border border-sep p-3.5 text-left space-y-1">
                    <div className="font-semibold text-subhead text-label leading-tight">
                      {triggeredAssistants[0].nama_pengeluaran}
                    </div>
                    <div className="text-caption2 font-semibold text-label-3 uppercase tracking-wider">
                      Kategori: {triggeredAssistants[0].kategori || "Lainnya"}
                    </div>
                    {triggeredAssistants[0].nominal ? (
                      <div className="text-callout font-bold text-tint tabular-nums pt-0.5">
                        {rupiah(Number(triggeredAssistants[0].nominal))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null
            }
            actions={
              triggeredAssistants[0]
                ? [
                    {
                      label: "Lewati",
                      role: "cancel",
                      onClick: () => handleDismissAssistant(triggeredAssistants[0].id),
                    },
                    {
                      label: "Simpan",
                      role: "primary",
                      onClick: () => handleRunAssistant(triggeredAssistants[0]),
                    },
                  ]
                : []
            }
          />

          <AlertDialog
            open={showUnsavedAlert}
            onClose={() => setShowUnsavedAlert(false)}
            zClassName="z-[300]"
            icon={<Save />}
            iconColor="orange"
            title="Data Belum Disimpan"
            description="Anda memiliki perubahan yang belum disimpan. Mohon simpan data terlebih dahulu sebelum membagikan PDF."
            actions={[
              { label: "Oke, Mengerti", role: "primary", onClick: () => setShowUnsavedAlert(false) },
            ]}
          />

          <PeringatanSewaHabis
            items={unverifiedRentals}
            userEmail={user?.email}
            jeda={!!paymentVerifyPrompt}
            onVerify={handleVerifyReturn}
            onPengingat={handleCatatPengingat}
          />

          <AlertDialog
            open={!!paymentVerifyPrompt}
            onClose={() => {}}
            dismissible={false}
            zClassName="z-[501]"
            icon={<AlertCircle />}
            iconColor="orange"
            title="Status Pembayaran?"
            description={
              paymentVerifyPrompt ? (
                <>
                  Penyewa <strong className="font-semibold text-label">{paymentVerifyPrompt.namaPenyewa}</strong> sebelumnya ditandai{" "}
                  <strong className="font-semibold text-negative">BELUM BAYAR</strong>. Apakah penyewa sudah bayar?
                </>
              ) : null
            }
            actions={[
              { label: "Tidak", role: "destructive", onClick: handlePaymentVerifyNo },
              { label: "Ya", role: "primary", onClick: handlePaymentVerifyYes },
            ]}
          />

          {showStokConfirmation && (
            <div className="fixed bottom-[calc(86px+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-[400] w-[92%] max-w-[380px] animate-in slide-in-from-bottom-6 fade-in duration-200">
              <div className="apple-glass rounded-sheet p-5 shadow-float ring-1 ring-black/10 dark:ring-white/15 flex flex-col items-center text-center gap-3.5">
                <IconBadge color="orange" variant="tinted" className="h-12 w-12 rounded-full [&>svg]:h-6 [&>svg]:w-6">
                  <Package />
                </IconBadge>
                <p className="text-subhead font-semibold text-label leading-snug">
                  Tolong dicek lagi stoknya, apakah update stok sudah sesuai?
                </p>
                <div className="flex gap-2.5 w-full">
                  <Button
                    variant="gray"
                    size="md"
                    className="flex-1"
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setShowRecheckAlert(true);
                    }}
                  >
                    Tidak
                  </Button>
                  <Button
                    variant="filled"
                    size="md"
                    className="flex-1"
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setActiveTab("USAHA RENTAL");
                      setTimeout(() => {
                        pdfRef.current?.share();
                      }, 300);
                    }}
                  >
                    Ya
                  </Button>
                </div>
              </div>
            </div>
          )}

          <AlertDialog
            open={showRecheckAlert}
            onClose={() => setShowRecheckAlert(false)}
            zClassName="z-[500]"
            icon={<Info />}
            iconColor="blue"
            title="Silakan Dicek Lagi"
            description="Pastikan stok barang Anda sudah diperbarui dengan benar sebelum menghasilkan Laporan PDF."
            actions={[
              { label: "Baik", role: "primary", onClick: () => setShowRecheckAlert(false) },
            ]}
          />

          <AlertDialog
            open={!!validationAlert}
            onClose={() => setValidationAlert(null)}
            zClassName="z-[300]"
            icon={<AlertCircle />}
            iconColor="red"
            title={validationAlert?.title ?? ""}
            description={validationAlert?.message}
            actions={[
              { label: "Siap, Dicek", role: "primary", onClick: () => setValidationAlert(null) },
            ]}
          />

          <AlertDialog
            open={showSuccessAlert}
            onClose={() => setShowSuccessAlert(false)}
            zClassName="z-[300]"
            icon={<CheckCircle2 />}
            iconColor="green"
            title="Berhasil"
            description={successMessage}
            actions={[
              { label: "Tutup", role: "primary", onClick: () => setShowSuccessAlert(false) },
            ]}
          />

          <AlertDialog
            open={showDuplicateDateAlert}
            onClose={() => setShowDuplicateDateAlert(false)}
            zClassName="z-[300]"
            icon={<AlertTriangle />}
            iconColor="red"
            title="Tanggal Sudah Terdaftar"
            description={`Data pembukuan untuk tanggal ${tanggal} sudah ada di history. Pilih tanggal lain atau edit data lama di tabel history di bawah.`}
            actions={[
              { label: "Oke, Mengerti", role: "primary", onClick: () => setShowDuplicateDateAlert(false) },
            ]}
          />

          {/* APP VERSION INDICATOR MOBILE */}
          <div className="md:hidden fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-3 z-30 text-caption2 font-mono text-label-3 pointer-events-none">
            V{versionData.version}
          </div>

          <LiveCursors users={activeUsers} currentUserEmail={user?.email || ""} />
          
          <Suspense fallback={null}>
            {showChallenge && (
              <ChallengeModal
                isOpen={showChallenge}
                onClose={() => setShowChallenge(false)}
              />
            )}
          </Suspense>
        </div>
      </div>
    </>
  );
}