import React, { useEffect, useState, Suspense, lazy } from "react";
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
import Grafik from "./components/Grafik";
import Footer from "./components/Footer";
import GeminiReportGenerator from "./components/GeminiReportGenerator";
import Reminder from "./components/Reminder";
import PdfExporter from "./components/PdfExporter";
import Pengaturan from "./components/Pengaturan";
import EditRincian from "./components/EditRincian"; 
import UpdateStok from "./components/UpdateStok"; 
import PageOwner from "./components/PageOwner";
import POSModal from "./components/POSModal";
import WidgetMonitoringStatus from "./components/WidgetMonitoringStatus";
import WidgetMonitoringDevice from "./components/WidgetMonitoringDevice";
import LiveCursors from "./components/LiveCursors";
import Login from "./components/Login";
import versionData from "./version.json";
import ChallengeButton from "./games/components/ChallengeButton";
import { Package, AlertCircle } from "lucide-react";
import { GAME_NAMES_ID } from "./games/constants";
import useAppController from "./hooks/useAppController";

const ChallengeModal = lazy(() => import("./games/components/ChallengeModal"));

export default function App() {
  const {
    rootRef,
    appStokData,
    pdfRef,
    hydrated,
    dark,
    setDark,
    themeMode,
    setThemeMode,
    showChallenge,
    setShowChallenge,
    gameConfig,
    kualitasGambar,
    setKualitasGambar,
    tableMode,
    setTableMode,
    isExportingPDF,
    setIsExportingPDF,
    isMobileTable,
    user,
    authLoading,
    userRole,
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
    setFocusedField,
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
    hasVersionUpdate,
    posUpdates,
    posBaseline,
    posBaselineLoaded,
    dbCatalogState,
    userProfileLoaded,
    isDeactivated,
    editingId,
    setEditingId,
    rukoBuka,
    setRukoBuka,
    rukoBukaDate,
    rukoTutup,
    setRukoTutup,
    rukoTutupDate,
    catatan,
    setCatatan,
    showDownloadAlert,
    setShowDownloadAlert,
    showDuplicateDateAlert,
    setShowDuplicateDateAlert,
    showNewMonthAlert,
    setShowNewMonthAlert,
    showUnsavedAlert,
    setShowUnsavedAlert,
    validationAlert,
    setValidationAlert,
    showSuccessAlert,
    setShowSuccessAlert,
    successMessage,
    setSuccessMessage,
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
    setOngkirConfig,
    absenConfig,
    setAbsenConfig,
    openEditRincian,
    setOpenEditRincian,
    getPrices,
    getHargaSewa,
    getTitle,
    handleSavePrices,
    handleResetSpecificDefault,
    rowsHarian,
    setRowsHarian,
    rowsJajanan,
    setRowsJajanan,
    rowsJasaAks,
    setRowsJasaAks,
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
    totalPengeluaranCash,
    manualPengeluaranCash,
    hasData,
    mandatoryFilled,
    history,
    setHistory,
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
    setUnverifiedRentals,
    paymentVerifyPrompt,
    setPaymentVerifyPrompt,
    handleVerifyReturn,
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
    setUserProfileColor,
    handleClearProductChange,
    handleResetRukoBuka,
    handleResetRukoTutup,
    handleResetAbsenPagi,
    handleResetAbsenSiang,
    handleResetForm,
    handleToggleTheme,
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

  if (authLoading || (user && !userProfileLoaded && !isDeactivated)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-[#1C1C1E]' : 'bg-zinc-100'}`}>
         <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent flex items-center justify-center rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || isDeactivated) {
    return <Login deactivatedError={isDeactivated ? "Email atau Password salah." : ""} />;
  }

  return (
    <>
      <PdfExporter 
        ref={pdfRef} rootRef={rootRef} dark={dark} 
        kualitasGambar={kualitasGambar} data={exportData}
        stokData={appStokData.stokState}
        masterCategories={appStokData.masterCategories}
        onStartExport={() => setIsExportingPDF(true)}
        onEndExport={() => setIsExportingPDF(false)}
      />
      
      <div 
         ref={rootRef} 
         className={`relative min-h-screen ${dark ? '' : 'bg-zinc-100'}`}
      >
        {/* Fixed background layer — Safari-compatible (no bg-fixed) */}
        {dark && (
          <div 
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: customBgDark ? `url(${customBgDark})` : "url('/images/bg_dark.jpg')" }}
            aria-hidden="true"
          />
        )}
        {dark && <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />}
        
        <div className="relative z-10 text-zinc-900 dark:text-zinc-100">
          <Header
              rootRef={rootRef} tanggal={tanggal} dark={dark}
              onToggleTheme={handleToggleTheme}
              onSharePDF={handleShareCheck}
              onOpenSettings={() => setOpenSettings(true)}
              onOpenScan={handleOpenScan}
              onOpenPOS={() => setOpenPOS(true)}
              hasData={hasData} mandatoryFilled={mandatoryFilled}
              isEditing={!!editingId}
              hasUnsavedChanges={currentFormSignature !== savedSignature}
              onSaveEdit={updatePencatatan} onAddData={addPencatatan} 
              onCancelEdit={() => window.location.reload()}
              userEmail={user?.email}
              userProfilePic={userProfilePic || undefined}
              activeUsers={activeUsers}
              hasPOSUpdate={hasPOSUpdate}
            />
          
          <main className="mx-auto max-w-6xl px-4 md:px-8 pb-24 space-y-6" style={{ paddingTop: 'calc(var(--app-header-height, 200px) + 16px)' }}>
            {/* TABS PENGATURAN HALAMAN */}
            <div className="flex w-full mb-8 bg-zinc-100/80 dark:bg-[#1C1C1E]/80 p-1 rounded-[14px] ring-1 ring-zinc-200/50 dark:ring-white/5 backdrop-blur-sm relative z-30 gap-1">
              {!isSuperAdminOrOwner && (
                <button
                  onClick={() => setActiveTab("MONITORING")}
                  className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                    activeTab === "MONITORING"
                      ? "bg-white dark:bg-[#2C2C2E] text-teal-600 dark:text-teal-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={activeTab === "MONITORING" && userProfileColor ? { color: userProfileColor } : undefined}
                >
                  MONITORING
                </button>
              )}
              {isSuperAdminOrOwner && (
                <button
                  onClick={() => setActiveTab("PAGE OWNER")}
                  className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                    activeTab === "PAGE OWNER"
                      ? "bg-white dark:bg-[#2C2C2E] text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={activeTab === "PAGE OWNER" && userProfileColor ? { color: userProfileColor } : undefined}
                >
                  PAGE OWNER
                </button>
              )}
              <button
                onClick={() => setActiveTab("USAHA RENTAL")}
                className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                  activeTab === "USAHA RENTAL"
                    ? "bg-white dark:bg-[#2C2C2E] text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={activeTab === "USAHA RENTAL" && userProfileColor ? { color: userProfileColor } : undefined}
              >
                USAHA RENTAL
              </button>
              <button
                onClick={() => setActiveTab("UPDATE STOK")}
                className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                  activeTab === "UPDATE STOK"
                    ? "bg-white dark:bg-[#2C2C2E] text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={activeTab === "UPDATE STOK" && userProfileColor ? { color: userProfileColor } : undefined}
              >
                UPDATE STOK
              </button>
            </div>

            {activeTab === "PAGE OWNER" && isSuperAdminOrOwner ? (
              <PageOwner
                totalHarian={totalHarian} totalJajanan={totalJajanan}
                totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                totalCash={totalCash} 
                totalTransfer={totalTransfer}
                totalPengeluaran={totalPengeluaran}
                pendapatanBersih={(totalHarian + totalJajanan + totalJasaAks + totalSewa) - totalPengeluaran}
                history={history}
                rowsSewa={rowsSewa}
                activeDate={tanggal}
                onVerifyActiveRental={handleVerifyReturn}
                hargaItems={hargaSewa}
                filterMode={filter}
                setFilterMode={setFilter}
                filterMonth={filterMonth}
                setFilterMonth={setFilterMonth}
                rangeStart={rangeStart}
                setRangeStart={setRangeStart}
                rangeEnd={rangeEnd}
                setRangeEnd={setRangeEnd}
                filteredHistory={filteredHistory}
                isVerifyingPayment={!!paymentVerifyPrompt}
                stokState={appStokData.stokState}
              />
            ) : activeTab === "MONITORING" && !isSuperAdminOrOwner ? (
              <div className="flex flex-col gap-4">
                {/* Segmented Pill Switcher for Admin */}
                <div className="flex justify-center z-10">
                  <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200/50 dark:border-white/5 shadow-inner">
                    <button
                      onClick={() => setAdminMonitoringTab("status")}
                      className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                        adminMonitoringTab === "status"
                          ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      Monitoring Status Unit
                    </button>
                    <button
                      onClick={() => setAdminMonitoringTab("device")}
                      className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                        adminMonitoringTab === "device"
                          ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      Monitoring Kondisi Unit
                    </button>
                  </div>
                </div>

                {adminMonitoringTab === "status" ? (
                  <div className="animate-in fade-in duration-200">
                    <WidgetMonitoringStatus 
                      history={history || []} 
                      rowsSewa={rowsSewa} 
                      activeDate={tanggal} 
                      onVerifyActiveRental={handleVerifyReturn} 
                      isOwner={false} 
                      hargaItems={hargaSewa}
                      isVerifyingPayment={!!paymentVerifyPrompt}
                    />
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-200">
                    <WidgetMonitoringDevice isOwner={false} />
                  </div>
                )}
              </div>
            ) : activeTab === "UPDATE STOK" ? (
              <UpdateStok
                adminName={user?.email}
                isOwner={isSuperAdminOrOwner}
                stokState={appStokData.stokState}
                updateStok={appStokData.updateStok}
                masterCategories={appStokData.masterCategories}
                addStokItem={appStokData.addStokItem}
              />
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
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
                  if (totalMin >= 585) return false;
                  const yesterday = new Date(wib);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
                  return history.some(h2 => h2.tanggal === yStr);
                })()}
              />
            </div>
            
            <div id="section-rincian" className="space-y-6">
              <ChallengeButton
                isAbsenDone={absenPagi !== "" || isSuperAdminOrOwner}
                activeGameName={gameConfig ? (GAME_NAMES_ID[gameConfig.activeGame] || gameConfig.activeGame) : ""}
                onClick={() => setShowChallenge(true)}
              />
              <RincianHarian rows={rowsHarian} setRows={setRowsHarian} blank={{ ...blankHarian }} hargaItems={hargaHarian} isMobileTable={isMobileTable} />
              <RincianJajanan rows={rowsJajanan} setRows={setRowsJajanan} blank={{ ...blankJajanan }} hargaItems={hargaJajanan} isMobileTable={isMobileTable} />
              <RincianJasaAksesoris rows={rowsJasaAks} setRows={setRowsJasaAks} blank={{ ...blankJasaAks }} isMobileTable={isMobileTable} />
              <RincianSewa rows={rowsSewa} setRows={setRowsSewa} blank={newBlankSewa()} hargaItems={hargaSewa} userEmail={user?.email} isMobileTable={isMobileTable}  />
            </div>
            <div className="space-y-6">
              <div id="section-pengeluaran">
                 <RincianPengeluaran 
                    rows={rowsPengeluaran} setRows={setRowsPengeluaran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                    userEmail={user?.email}
                    isOwner={isSuperAdminOrOwner}
                 />
              </div>
              <div id="section-setoran">
                 <RincianSetoran 
                    rows={rowsSetoran} setRows={setRowsSetoran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                 />
              </div>
            </div>
            
            <div id="section-rekap" className="pt-2">
              <RekapPemasukan
                totalHarian={totalHarian} totalJajanan={totalJajanan}
                totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                totalCash={totalCash} 
                totalTransfer={totalTransfer}
                totalPengeluaran={totalPengeluaran}
                pendapatanBersih={(totalHarian + totalJajanan + totalJasaAks + totalSewa) - totalPengeluaran}
              />
            </div>
            
            {isSuperAdminOrOwner && (
              <FilterComp
                mode={filter} setMode={setFilter} month={filterMonth} setMonth={setFilterMonth}
                rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
              />
            )}
            
            <div id="section-history" className="pt-2">
              <HistoryPembukuan
                items={filteredHistory}
                onClear={() => { if (history.length > 0 && confirm("Bersihkan SEMUA history pembukuan?")) setHistory([]); }}
                onEdit={editHistoryItem} onDelete={deleteHistoryItem}
                isOwner={isSuperAdminOrOwner}
              />
            </div>
            
            <GeminiReportGenerator history={history} currentDate={tanggal} currentData={exportData} />
            
            <Reminder />
              </div>
            )}
            <Footer />
          </main>
          
          <EditRincian
            isOpen={!!openEditRincian}
            title={getTitle(openEditRincian)}
            initialData={openEditRincian ? getPrices(openEditRincian) : []}
            onClose={() => setOpenEditRincian(null)}
            onSave={(items) => openEditRincian && handleSavePrices(openEditRincian, items)}
            onResetDefault={() => openEditRincian && handleResetSpecificDefault(openEditRincian)}
          />

          <input ref={restoreInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => onPickRestoreFile(e.target.files?.[0] ?? null)} />
          
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
            userEmail={user?.email}
            userProfilePic={userProfilePic || undefined}
            onProfilePicChange={handleProfilePicChange}
            customBgDark={customBgDark || undefined}
            onBgDarkChange={(url) => handleBgDarkChange(url)}
            userProfileColor={userProfileColor}
            onProfileColorChange={handleUpdateProfileColor}
            history={history}
          />

          <POSModal
            open={openPOS}
            onClose={() => setOpenPOS(false)}
            isSuperAdminOrOwner={isSuperAdminOrOwner}
            adminName={user?.email ? user.email.split('@')[0] : "Admin"}
            catalogChanges={catalogChanges}
            onClearProductChange={handleClearProductChange}
          />

          {/* === POPUPS: APPLE UI STYLE === */}
          {showUnsavedAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowUnsavedAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Data Belum Disimpan</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Anda memiliki perubahan yang belum disimpan. Mohon simpan data terlebih dahulu sebelum membagikan PDF.</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowUnsavedAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Oke, Mengerti</button>
                </div>
              </div>
            </div>
          )}

          {unverifiedRentals.length > 0 && !paymentVerifyPrompt && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
                <div className="p-6 text-center flex flex-col items-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-4 ring-red-500/10">
                     <AlertCircle className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Waktu Sewa Habis!</h3>
                  {(() => {
                    const profileName = (user?.email || "").split("@")[0];
                    const capitalizedName = profileName ? profileName.charAt(0).toUpperCase() + profileName.slice(1) : "Admin";
                    const item = unverifiedRentals[0];
                    return (
                      <>
                        <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
                          Unit <strong className="text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{item?.jenis}</strong> atas nama <strong className="text-blue-600 dark:text-blue-400">{item?.namaPenyewa}</strong> telah selesai durasi sewanya.
                        </p>
                        <p className="text-[16px] font-bold text-zinc-900 dark:text-white mb-4 leading-tight tracking-tight">Apakah sewa sudah habis atau belum, {capitalizedName}?</p>
                      </>
                    );
                  })()}
                </div>
                <div className="flex flex-col border-t border-gray-200/50 dark:border-white/10">
                  <button 
                    onClick={() => handleVerifyReturn(unverifiedRentals[0])} 
                    className="w-full py-4 text-[15px] shadow-inner font-black text-blue-600 dark:text-blue-500 bg-white/50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors active:bg-blue-100 dark:active:bg-blue-500/20"
                  >
                    YA, SUDAH HABIS & KEMBALI
                  </button>
                </div>
              </div>
            </div>
          )}

          {paymentVerifyPrompt && (
            <div className="fixed inset-0 z-[501] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
                <div className="p-6 text-center flex flex-col items-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 ring-4 ring-orange-500/10">
                     <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Status Pembayaran?</h3>
                  <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
                    Penyewa <strong className="text-blue-600 dark:text-blue-400">{paymentVerifyPrompt.namaPenyewa}</strong> sebelumnya ditandai <strong className="text-red-500">BELUM BAYAR</strong>. Apakah penyewa sudah bayar?
                  </p>
                </div>
                <div className="flex border-t border-gray-200/50 dark:border-white/10 divide-x divide-gray-200/50 dark:divide-white/10">
                  <button 
                    onClick={handlePaymentVerifyNo} 
                    className="flex-1 py-4 text-[14px] font-bold text-red-600 dark:text-red-400 bg-white/50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    TIDAK
                  </button>
                  <button 
                    onClick={handlePaymentVerifyYes} 
                    className="flex-1 py-4 text-[14px] font-bold text-emerald-600 dark:text-emerald-500 bg-white/50 dark:bg-black/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                  >
                    YA
                  </button>
                </div>
              </div>
            </div>
          )}

          {showStokConfirmation && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl rounded-[24px] p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col items-center text-center gap-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                  <Package className="w-6 h-6" />
                </div>
                <p className="text-[15px] font-bold text-zinc-900 dark:text-white leading-snug">
                  TOLONG DI CEK LAGI STOK NYA,<br/>APAKAH UPDATE STOK SUDAH SESUAI?
                </p>
                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setShowRecheckAlert(true);
                    }}
                    className="flex-1 py-3 text-[14px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    TIDAK
                  </button>
                  <button
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setActiveTab("USAHA RENTAL");
                      setTimeout(() => {
                        pdfRef.current?.share();
                      }, 300);
                    }}
                    className="flex-1 py-3 text-[14px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-500/20"
                  >
                    YA
                  </button>
                </div>
              </div>
            </div>
          )}

          {showRecheckAlert && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowRecheckAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Silakan Di Cek Lagi</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Pastikan stok barang Anda sudah diperbarui dengan benar sebelum menghasilkan Laporan PDF.</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowRecheckAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Baik</button>
                </div>
              </div>
            </div>
          )}

          {validationAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setValidationAlert(null)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">{validationAlert.title}</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {validationAlert.message}
                  </p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setValidationAlert(null)} className="w-full py-3.5 text-[15px] font-semibold text-red-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Siap, Dicek</button>
                </div>
              </div>
            </div>
          )}

          {showSuccessAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowSuccessAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Berhasil</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{successMessage}</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowSuccessAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-green-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Tutup</button>
                </div>
              </div>
            </div>
          )}

          {showDuplicateDateAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowDuplicateDateAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Tanggal Sudah Terdaftar</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Data pembukuan untuk tanggal {tanggal} sudah ada di history. Pilih tanggal lain atau edit data lama di tabel history di bawah.</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowDuplicateDateAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Oke, Mengerti</button>
                </div>
              </div>
            </div>
          )}

          {/* APP VERSION INDICATOR */}
          <div className="fixed bottom-4 right-4 z-40 bg-zinc-950/70 text-zinc-400 text-[10px] font-mono px-2 py-1 rounded-md pointer-events-none tracking-wider">
             BUILD V{versionData.version}
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